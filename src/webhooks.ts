/**
 * Webhook signature verification and typed event parsing.
 *
 * `constructEvent` verifies the HMAC-SHA256 signature on an inbound webhook
 * request and returns a typed `CurviateEvent`. It is framework-agnostic:
 * works in Node ≥ 18, Cloudflare Workers, Vercel Edge, and any runtime that
 * exposes the Web Crypto API via `globalThis.crypto.subtle`.
 *
 * Security properties:
 * - No third-party crypto dependency.
 * - Web Crypto (`globalThis.crypto.subtle`) when available; Node `crypto` module
 *   fallback when `crypto.subtle` is absent.
 * - Because `crypto.subtle` is async and `constructEvent` must be synchronous
 *   (usable inline in Express/Hono handlers), the sync Node `createHmac` is used
 *   on Node runtimes. The Web Crypto async path is used where `require` is
 *   unavailable (Cloudflare Workers, Vercel Edge — those runtimes do not expose
 *   `require` but do expose `crypto.subtle`). Runtime detection chooses the path.
 * - HMAC comparison is constant-time: byte-by-byte XOR accumulation, no early
 *   return on first mismatch (prevents timing-oracle attacks).
 * - Replay guard: reject events older than `replayWindowMs` (default 300 s).
 */

// ─── WebhookSignatureError ────────────────────────────────────────────────────

/**
 * Thrown by {@link constructEvent} when signature verification fails.
 *
 * Extends `Error`, NOT `CurviateError` — callers can narrow with
 * `instanceof WebhookSignatureError` independently of CurviateError.
 *
 * @example
 * try {
 *   const event = constructEvent(rawBody, header, secret);
 * } catch (err) {
 *   if (err instanceof WebhookSignatureError) {
 *     if (err.reason === 'replay_detected') { ... }
 *   }
 * }
 */
export class WebhookSignatureError extends Error {
  override readonly name = "WebhookSignatureError";
  /** Structured reason code for the verification failure. */
  readonly reason: "invalid_signature" | "replay_detected" | "malformed_header";

  constructor(reason: WebhookSignatureError["reason"], message: string) {
    super(message);
    this.reason = reason;
    Object.setPrototypeOf(this, WebhookSignatureError.prototype);
  }
}

// ─── CurviateEvent discriminated union ──────────────────────────────────────

/**
 * Payload carried by message-type events.
 */
export interface MessagePayload {
  message_id?: string;
  account_id: string;
  [key: string]: unknown;
}

/**
 * Payload carried by connection-type events.
 */
export interface ConnectionPayload {
  account_id: string;
  [key: string]: unknown;
}

/**
 * Payload carried by account-state events.
 */
export interface AccountPayload {
  account_id: string;
  [key: string]: unknown;
}

/**
 * The complete discriminated union of all 19 canonical Curviate webhook events.
 * The `type` field is the discriminant.
 *
 * @example
 * const event = constructEvent(rawBody, header, secret);
 * if (event.type === 'message.received') {
 *   // event.data is MessagePayload
 * }
 */
export type CurviateEvent =
  | { type: "message.received"; data: MessagePayload }
  | { type: "message.delivered"; data: MessagePayload }
  | { type: "message.read"; data: MessagePayload }
  | { type: "message.edited"; data: MessagePayload }
  | { type: "message.deleted"; data: MessagePayload }
  | { type: "message.reaction"; data: MessagePayload }
  | { type: "connection.accepted"; data: ConnectionPayload }
  | { type: "account.created"; data: AccountPayload }
  | { type: "account.connected"; data: AccountPayload }
  | { type: "account.disconnected"; data: AccountPayload }
  | { type: "account.error"; data: AccountPayload }
  | { type: "account.stopped"; data: AccountPayload }
  | { type: "account.sync_started"; data: AccountPayload }
  | { type: "account.sync_complete"; data: AccountPayload }
  | { type: "account.creation_success"; data: AccountPayload }
  | { type: "account.creation_failed"; data: AccountPayload }
  | { type: "account.sync_success"; data: AccountPayload }
  | { type: "account.reconnect_required"; data: AccountPayload }
  | { type: "account.checkpoint"; data: AccountPayload };

// ─── Header parsing ──────────────────────────────────────────────────────────

interface ParsedHeader {
  timestamp: number;
  v1: string;
}

function parseHeader(header: string): ParsedHeader {
  const parts = header.split(",");
  let tStr: string | undefined;
  let v1: string | undefined;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === "t") tStr = val;
    else if (key === "v1") v1 = val;
  }
  if (tStr === undefined || v1 === undefined) {
    throw new WebhookSignatureError(
      "malformed_header",
      'Webhook signature header must contain both "t=<timestamp>" and "v1=<hmac>".',
    );
  }
  const timestamp = Number(tStr);
  if (!Number.isFinite(timestamp) || isNaN(timestamp)) {
    throw new WebhookSignatureError(
      "malformed_header",
      "Webhook signature header timestamp is not a valid number.",
    );
  }
  return { timestamp, v1 };
}

// ─── Hex encoding helpers ────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new WebhookSignatureError("malformed_header", "HMAC hex has odd length.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) {
      throw new WebhookSignatureError("malformed_header", "HMAC hex contains non-hex character.");
    }
    bytes[i] = byte;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Constant-time comparison ────────────────────────────────────────────────

/**
 * Compare two byte arrays in constant time — no early return on first mismatch.
 * The loop always runs over the full range of `Math.max(a.length, b.length)`.
 * Accumulated bitwise-OR `diff` encodes any difference; returns true only when
 * `diff === 0` (all bytes matched, lengths matched).
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  // Seed with length mismatch so unequal-length inputs always fail.
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ai = i < a.length ? (a[i] as number) : 0;
    const bi = i < b.length ? (b[i] as number) : 0;
    diff |= ai ^ bi;
  }
  return diff === 0;
}

// ─── HMAC-SHA256 computation ─────────────────────────────────────────────────

/**
 * Detect whether we're in a runtime that has `require` (Node / bundled Node).
 * Cloudflare Workers and Vercel Edge do NOT have `require`, but they DO have
 * `globalThis.crypto.subtle` — the async Web Crypto path is used there.
 */
function hasRequire(): boolean {
  return typeof require === "function";
}

/**
 * Detect Web Crypto availability.
 */
function hasWebCrypto(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto === "object" &&
    globalThis.crypto !== null &&
    typeof (globalThis.crypto as Crypto).subtle === "object" &&
    typeof (globalThis.crypto as Crypto).subtle.importKey === "function"
  );
}

/**
 * Synchronous HMAC-SHA256 via Node `crypto.createHmac`.
 * Used in Node runtimes where `require` is available.
 */
function hmacSyncNode(secret: string, payload: string): string {
  // Dynamic require: valid in Node ≥ 18; this branch is only taken when
  // `hasRequire()` returns true.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("node:crypto") as typeof import("node:crypto");
  return nodeCrypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Async HMAC-SHA256 via Web Crypto (`globalThis.crypto.subtle`).
 * Used in edge runtimes (Cloudflare Workers, Vercel Edge) where `require` is absent.
 * The result is returned as a hex string.
 */
async function hmacAsyncWebCrypto(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", keyMaterial, enc.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

// ─── constructEvent options ───────────────────────────────────────────────────

/**
 * Options for {@link constructEvent}.
 */
export interface ConstructEventOptions {
  /**
   * Maximum age in milliseconds of a webhook event before it is rejected as a
   * replay. Default: 300_000 (5 minutes).
   */
  replayWindowMs?: number;
}

// ─── Core verification logic (shared by sync and async paths) ────────────────

function verifyAndParse(
  computedHex: string,
  v1: string,
  timestamp: number,
  bodyStr: string,
  replayWindowMs: number,
): CurviateEvent {
  // Step 3 — constant-time HMAC comparison.
  let providedBytes: Uint8Array;
  try {
    providedBytes = hexToBytes(v1);
  } catch {
    // hexToBytes throws WebhookSignatureError for invalid hex
    throw new WebhookSignatureError(
      "invalid_signature",
      "Webhook signature v1 value is not valid hex.",
    );
  }
  const computedBytes = hexToBytes(computedHex);
  if (!constantTimeEqual(computedBytes, providedBytes)) {
    throw new WebhookSignatureError(
      "invalid_signature",
      "Webhook signature does not match. Verify your signing secret.",
    );
  }

  // Step 4 — replay guard.
  const age = Date.now() - timestamp;
  if (age > replayWindowMs) {
    throw new WebhookSignatureError(
      "replay_detected",
      `Webhook event is too old (${Math.floor(age / 1000)}s, window is ${Math.floor(replayWindowMs / 1000)}s).`,
    );
  }

  // Step 5 — parse the JSON body into a typed CurviateEvent.
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyStr);
  } catch {
    throw new WebhookSignatureError("malformed_header", "Webhook body is not valid JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["type"] !== "string"
  ) {
    throw new WebhookSignatureError("malformed_header", 'Webhook payload missing "type" field.');
  }

  return parsed as CurviateEvent;
}

// ─── constructEvent (synchronous on Node, async on edge runtimes) ────────────

/**
 * Verify a Curviate webhook signature and parse the event payload.
 *
 * **Node runtimes (18+):** synchronous — safe to call inline in any handler.
 * **Edge runtimes** (Cloudflare Workers, Vercel Edge): uses Web Crypto, which is
 * async. The return type is `CurviateEvent` in both cases — TypeScript consumers
 * that target edge runtimes without `require` should use `await constructEvent(...)`.
 * The returned value is always a `CurviateEvent` (Promise resolves immediately on
 * Node; the Promise is the value on edge runtimes).
 *
 * For a runtime-agnostic API, always `await` the result.
 *
 * @param rawBody - The raw (un-parsed) request body as a string or Buffer.
 *   **Must be the exact bytes received** — do not JSON.parse then re-serialize.
 * @param signatureHeader - Full value of the `X-Curviate-Signature` header.
 * @param secret - The webhook signing secret from your webhook registration.
 * @param opts - Optional verification settings.
 * @returns A typed `CurviateEvent` (or `Promise<CurviateEvent>` on edge runtimes).
 * @throws {WebhookSignatureError} if the header is malformed, the HMAC is
 *   invalid, or the timestamp is outside the replay window.
 *
 * @example
 * // Express handler (Node — synchronous)
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const event = constructEvent(req.body, req.headers['x-curviate-signature'], secret);
 *   if (event.type === 'message.received') { ... }
 *   res.sendStatus(200);
 * });
 *
 * @example
 * // Hono handler (edge — always await)
 * app.post('/webhook', async (c) => {
 *   const rawBody = await c.req.text();
 *   const event = await constructEvent(rawBody, c.req.header('x-curviate-signature')!, secret);
 *   return c.text('ok');
 * });
 */
export function constructEvent(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
  opts?: ConstructEventOptions,
): CurviateEvent;
export function constructEvent(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
  opts?: ConstructEventOptions,
): CurviateEvent | Promise<CurviateEvent>;
export function constructEvent(
  rawBody: string | Buffer,
  signatureHeader: string,
  secret: string,
  opts?: ConstructEventOptions,
): CurviateEvent | Promise<CurviateEvent> {
  const replayWindowMs = opts?.replayWindowMs ?? 300_000;

  // Step 1 — parse the header.
  const { timestamp, v1 } = parseHeader(signatureHeader);

  // Step 2 — compute HMAC-SHA256(secret, "<timestamp>.<rawBody>").
  const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const hmacPayload = `${timestamp}.${bodyStr}`;

  if (hasRequire()) {
    // Node runtime — synchronous path.
    const computedHex = hmacSyncNode(secret, hmacPayload);
    return verifyAndParse(computedHex, v1, timestamp, bodyStr, replayWindowMs);
  }

  if (hasWebCrypto()) {
    // Edge runtime (Cloudflare Workers, Vercel Edge) — async Web Crypto path.
    return hmacAsyncWebCrypto(secret, hmacPayload).then((computedHex) =>
      verifyAndParse(computedHex, v1, timestamp, bodyStr, replayWindowMs),
    );
  }

  // No crypto available — fail safe.
  throw new WebhookSignatureError(
    "invalid_signature",
    "No cryptographic runtime available (neither Node crypto nor Web Crypto).",
  );
}
