/**
 * constructEvent, WebhookSignatureError, CurviateEvent.
 *
 * Crypto in tests: use Node's built-in `crypto` to derive a valid HMAC header
 * so we don't depend on constructEvent for setup.
 *
 * Wire format: t=<Unix-seconds (integer)>, v1=<HMAC-SHA256 hex over "<t>.<body>">.
 * The replay window option is `replayWindowSecs` (seconds), matching the server.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  constructEvent,
  type CurviateEvent,
  WebhookSignatureError,
} from "../src/index.js";
import { CurviateError } from "../src/index.js";

// ─── Test helper: build a valid X-Curviate-Signature header ─────────────────
//
// timestamp must be Unix SECONDS (integer) — the server signs with
// Math.floor(Date.now()/1000), and the SDK verifies against the same unit.

function makeHeader(rawBody: string, secret: string, timestampSecs: number): string {
  const payload = `${timestampSecs}.${rawBody}`;
  const hmac = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestampSecs},v1=${hmac}`;
}

/** Current time as Unix seconds (integer), matching the server. */
function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ type: "message.received", data: { message_id: "msg_1", account_id: "acc_1" } });
const BODY_ACCOUNT = JSON.stringify({ type: "account.connected", data: { account_id: "acc_1" } });

// ─── happy path ──────────────────────────────────────────────────────────────

describe("constructEvent — happy path", () => {
  it("returns a typed CurviateEvent with correct type and data", async () => {
    const t = nowSecs();
    const header = makeHeader(BODY, SECRET, t);
    const event: CurviateEvent = await constructEvent(BODY, header, SECRET, { replayWindowSecs: 60 });
    expect(event.type).toBe("message.received");
    expect((event.data as Record<string, unknown>)["message_id"]).toBe("msg_1");
    expect((event.data as Record<string, unknown>)["account_id"]).toBe("acc_1");
  });

  it("accepts a Buffer rawBody", async () => {
    const t = nowSecs();
    const bodyBuf = Buffer.from(BODY, "utf8");
    const header = makeHeader(BODY, SECRET, t);
    const event = await constructEvent(bodyBuf, header, SECRET, { replayWindowSecs: 60 });
    expect(event.type).toBe("message.received");
  });

  it("handles an account-type event", async () => {
    const t = nowSecs();
    const header = makeHeader(BODY_ACCOUNT, SECRET, t);
    const event = await constructEvent(BODY_ACCOUNT, header, SECRET, { replayWindowSecs: 60 });
    expect(event.type).toBe("account.connected");
  });

  it("accepts an event ~1 second old (within window)", async () => {
    // Signing 1 second in the past — well within any reasonable window.
    const t = nowSecs() - 1;
    const header = makeHeader(BODY, SECRET, t);
    await expect(
      constructEvent(BODY, header, SECRET, { replayWindowSecs: 60 })
    ).resolves.toMatchObject({ type: "message.received" });
  });
});

// ─── tampered signature ───────────────────────────────────────────────────────

describe("constructEvent — tampered signature", () => {
  it("throws WebhookSignatureError with reason: invalid_signature", async () => {
    const t = nowSecs();
    const tamperedHeader = `t=${t},v1=bad_hmac_value_1234567890abcdef`;
    await expect(constructEvent(BODY, tamperedHeader, SECRET)).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(constructEvent(BODY, tamperedHeader, SECRET)).rejects.toMatchObject({
      reason: "invalid_signature",
    });
  });

  it("throws even if one byte differs", async () => {
    const t = nowSecs();
    const validHeader = makeHeader(BODY, SECRET, t);
    // Flip the last character of the v1 value
    const flipped = validHeader.slice(0, -1) + (validHeader.at(-1) === "a" ? "b" : "a");
    await expect(constructEvent(BODY, flipped, SECRET)).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("throws on wrong secret", async () => {
    const t = nowSecs();
    const header = makeHeader(BODY, "wrong_secret", t);
    await expect(constructEvent(BODY, header, SECRET)).rejects.toMatchObject({
      reason: "invalid_signature",
    });
  });
});

// ─── replay detection ────────────────────────────────────────────────────────

describe("constructEvent — replay detection", () => {
  it("throws replay_detected for a timestamp from Unix epoch (always outside window)", async () => {
    // t=0 (1970-01-01) is always more than 300s in the past
    const oldTimestampSecs = 0;
    const header = makeHeader(BODY, SECRET, oldTimestampSecs);
    await expect(constructEvent(BODY, header, SECRET)).rejects.toMatchObject({
      reason: "replay_detected",
    });
  });

  it("throws replay_detected for a timestamp 10 minutes old (outside default 5-min window)", async () => {
    const oldTimestampSecs = nowSecs() - 600; // 10 min ago
    const header = makeHeader(BODY, SECRET, oldTimestampSecs);
    await expect(
      constructEvent(BODY, header, SECRET, { replayWindowSecs: 300 })
    ).rejects.toMatchObject({ reason: "replay_detected" });
  });

  it("accepts a timestamp from 4 minutes ago (within 5-min default window)", async () => {
    const t = nowSecs() - 240; // 4 min ago
    const header = makeHeader(BODY, SECRET, t);
    await expect(
      constructEvent(BODY, header, SECRET, { replayWindowSecs: 300 })
    ).resolves.toMatchObject({ type: "message.received" });
  });

  it("rejects a future timestamp beyond the window (future-skew guard)", async () => {
    // t is 10 minutes in the future — Math.abs check catches this too
    const futureTimestampSecs = nowSecs() + 600;
    const header = makeHeader(BODY, SECRET, futureTimestampSecs);
    await expect(
      constructEvent(BODY, header, SECRET, { replayWindowSecs: 300 })
    ).rejects.toMatchObject({ reason: "replay_detected" });
  });

  it("signature is checked before replay (tampered + expired = invalid_signature, not replay_detected)", async () => {
    // The spec step order: 1. parse 2. compute 3. compare 4. replay
    // A tampered header with an old timestamp should fail at step 3.
    const badHeader = `t=0,v1=bad_hmac_value_1234567890abcdef`;
    await expect(constructEvent(BODY, badHeader, SECRET)).rejects.toMatchObject({
      reason: "invalid_signature",
    });
  });
});

// ─── malformed header ────────────────────────────────────────────────────────

describe("constructEvent — malformed header", () => {
  it("throws WebhookSignatureError with reason: malformed_header for 'garbage'", async () => {
    await expect(constructEvent(BODY, "garbage", SECRET)).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(constructEvent(BODY, "garbage", SECRET)).rejects.toMatchObject({
      reason: "malformed_header",
    });
  });

  it("throws malformed_header for missing v1 component", async () => {
    await expect(
      constructEvent(BODY, `t=${nowSecs()}`, SECRET)
    ).rejects.toMatchObject({ reason: "malformed_header" });
  });

  it("throws malformed_header for missing t component", async () => {
    const hmac = createHmac("sha256", SECRET).update(BODY).digest("hex");
    await expect(
      constructEvent(BODY, `v1=${hmac}`, SECRET)
    ).rejects.toMatchObject({ reason: "malformed_header" });
  });

  it("throws malformed_header for non-numeric timestamp", async () => {
    const hmac = createHmac("sha256", SECRET).update(BODY).digest("hex");
    await expect(
      constructEvent(BODY, `t=notanumber,v1=${hmac}`, SECRET)
    ).rejects.toMatchObject({ reason: "malformed_header" });
  });

  it("throws malformed_header for empty string header", async () => {
    await expect(
      constructEvent(BODY, "", SECRET)
    ).rejects.toMatchObject({ reason: "malformed_header" });
  });
});

// ─── WebhookSignatureError identity ──────────────────────────────────────────

describe("WebhookSignatureError identity", () => {
  it("is an instance of Error but NOT an instance of CurviateError", async () => {
    let caught: unknown;
    try {
      await constructEvent(BODY, "garbage", SECRET);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(WebhookSignatureError);
    expect(caught).not.toBeInstanceOf(CurviateError);
  });

  it("has the reason property and correct message", async () => {
    try {
      await constructEvent(BODY, "garbage", SECRET);
    } catch (err) {
      const wse = err as WebhookSignatureError;
      expect(typeof wse.reason).toBe("string");
      expect(wse.message.length).toBeGreaterThan(0);
      expect(wse.name).toBe("WebhookSignatureError");
    }
  });
});
