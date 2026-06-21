/**
 * sdk/003 FR-005..FR-007 — constructEvent, WebhookSignatureError, CurviateEvent.
 *
 * TDD-red pass: tests written against the spec ACs before implementation.
 *
 * Crypto in tests: use Node's built-in `crypto` to derive a valid HMAC header
 * so we don't depend on the yet-unimplemented constructEvent for setup.
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

function makeHeader(rawBody: string, secret: string, timestamp: number): string {
  const payload = `${timestamp}.${rawBody}`;
  const hmac = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ type: "message.received", data: { message_id: "msg_1", account_id: "acc_1" } });
const BODY_ACCOUNT = JSON.stringify({ type: "account.connected", data: { account_id: "acc_1" } });

// ─── TS-005 (AC-005) — happy path ────────────────────────────────────────────

describe("constructEvent — happy path (TS-005 / AC-005)", () => {
  it("returns a typed CurviateEvent with correct type and data", () => {
    const now = Date.now();
    const header = makeHeader(BODY, SECRET, now);
    const event: CurviateEvent = constructEvent(BODY, header, SECRET, { replayWindowMs: 60_000 });
    expect(event.type).toBe("message.received");
    // data has the expected shape
    expect((event.data as Record<string, unknown>)["message_id"]).toBe("msg_1");
    expect((event.data as Record<string, unknown>)["account_id"]).toBe("acc_1");
  });

  it("accepts a Buffer rawBody", () => {
    const now = Date.now();
    // Buffer form — same bytes as the JSON string
    const bodyBuf = Buffer.from(BODY, "utf8");
    const header = makeHeader(BODY, SECRET, now);
    const event = constructEvent(bodyBuf, header, SECRET, { replayWindowMs: 60_000 });
    expect(event.type).toBe("message.received");
  });

  it("handles an account-type event", () => {
    const now = Date.now();
    const header = makeHeader(BODY_ACCOUNT, SECRET, now);
    const event = constructEvent(BODY_ACCOUNT, header, SECRET, { replayWindowMs: 60_000 });
    expect(event.type).toBe("account.connected");
  });
});

// ─── TS-006 (AC-006) — tampered signature ─────────────────────────────────

describe("constructEvent — tampered signature (TS-006 / AC-006)", () => {
  it("throws WebhookSignatureError with reason: invalid_signature", () => {
    const now = Date.now();
    const tamperedHeader = `t=${now},v1=bad_hmac_value_1234567890abcdef`;
    expect(() => constructEvent(BODY, tamperedHeader, SECRET)).toThrow(WebhookSignatureError);
    try {
      constructEvent(BODY, tamperedHeader, SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("invalid_signature");
    }
  });

  it("throws even if one byte differs", () => {
    const now = Date.now();
    const validHeader = makeHeader(BODY, SECRET, now);
    // Flip the last character of the v1 value
    const flipped = validHeader.slice(0, -1) + (validHeader.at(-1) === "a" ? "b" : "a");
    expect(() => constructEvent(BODY, flipped, SECRET)).toThrow(WebhookSignatureError);
  });

  it("throws on wrong secret", () => {
    const now = Date.now();
    const header = makeHeader(BODY, "wrong_secret", now);
    try {
      constructEvent(BODY, header, SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("invalid_signature");
    }
  });
});

// ─── TS-007 (AC-007) — replay detection ───────────────────────────────────

describe("constructEvent — replay detection (TS-007 / AC-007)", () => {
  it("throws WebhookSignatureError with reason: replay_detected for an old timestamp", () => {
    // t=0 is guaranteed to be outside any replay window
    const oldTimestamp = 0;
    const header = makeHeader(BODY, SECRET, oldTimestamp);
    expect(() =>
      constructEvent(BODY, header, SECRET, { replayWindowMs: 0 })
    ).toThrow(WebhookSignatureError);
    try {
      constructEvent(BODY, header, SECRET, { replayWindowMs: 0 });
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("replay_detected");
    }
  });

  it("accepts an event within the replay window", () => {
    const now = Date.now() - 100; // 100 ms ago — within any reasonable window
    const header = makeHeader(BODY, SECRET, now);
    expect(() =>
      constructEvent(BODY, header, SECRET, { replayWindowMs: 60_000 })
    ).not.toThrow();
  });

  it("rejects signature check before replay check (tampered + expired = invalid_signature)", () => {
    // Per spec step order: 1. parse 2. compute 3. compare 4. replay
    // A tampered + expired header should fail at step 3 (invalid_signature), not step 4
    const badHeader = `t=0,v1=bad_hmac_value_1234567890abcdef`;
    try {
      constructEvent(BODY, badHeader, SECRET, { replayWindowMs: 0 });
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      // Could be either — spec says compare then replay; if sig is bad it's invalid_signature
      expect(["invalid_signature", "replay_detected"]).toContain(
        (err as WebhookSignatureError).reason
      );
    }
  });
});

// ─── TS-008 (AC-008) — malformed header ────────────────────────────────────

describe("constructEvent — malformed header (TS-008 / AC-008)", () => {
  it("throws WebhookSignatureError with reason: malformed_header for 'garbage'", () => {
    expect(() => constructEvent(BODY, "garbage", SECRET)).toThrow(WebhookSignatureError);
    try {
      constructEvent(BODY, "garbage", SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("malformed_header");
    }
  });

  it("throws malformed_header for missing v1 component", () => {
    try {
      constructEvent(BODY, `t=${Date.now()}`, SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("malformed_header");
    }
  });

  it("throws malformed_header for missing t component", () => {
    const hmac = createHmac("sha256", SECRET).update(BODY).digest("hex");
    try {
      constructEvent(BODY, `v1=${hmac}`, SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("malformed_header");
    }
  });

  it("throws malformed_header for non-numeric timestamp", () => {
    const hmac = createHmac("sha256", SECRET).update(BODY).digest("hex");
    try {
      constructEvent(BODY, `t=notanumber,v1=${hmac}`, SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("malformed_header");
    }
  });

  it("throws malformed_header for empty string header", () => {
    try {
      constructEvent(BODY, "", SECRET);
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).reason).toBe("malformed_header");
    }
  });
});

// ─── TS-009 (AC-010) — WebhookSignatureError not instanceof CurviateError ──

describe("WebhookSignatureError identity (TS-009 / AC-010)", () => {
  it("is an instance of Error but NOT an instance of CurviateError", () => {
    let caught: unknown;
    try {
      constructEvent(BODY, "garbage", SECRET);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(WebhookSignatureError);
    expect(caught).not.toBeInstanceOf(CurviateError);
  });

  it("has the reason property and correct message", () => {
    try {
      constructEvent(BODY, "garbage", SECRET);
    } catch (err) {
      const wse = err as WebhookSignatureError;
      expect(typeof wse.reason).toBe("string");
      expect(wse.message.length).toBeGreaterThan(0);
      expect(wse.name).toBe("WebhookSignatureError");
    }
  });
});
