/**
 * Black-box regression gate for `constructEvent` against the built dist.
 *
 * This script imports `../dist/index.js` (NOT src/) and exercises the
 * happy path + replay detection end-to-end. It MUST be run after `pnpm build`.
 *
 * Run: node scripts/verify-dist.mjs
 * Exit 0 = all assertions passed.
 * Exit 1 = a case failed — prints the failure and aborts.
 */

import { createHmac } from "node:crypto";
// Import from the built dist — this is the whole point.
import { constructEvent, WebhookSignatureError } from "../dist/index.js";

function assert(condition, label) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

function makeHeader(rawBody, secret, timestampSecs) {
  const payload = `${timestampSecs}.${rawBody}`;
  const hmac = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestampSecs},v1=${hmac}`;
}

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ type: "message.received", data: { message_id: "msg_1", account_id: "acc_1" } });

async function main() {
  console.log("=== verify-dist: constructEvent black-box gate ===\n");

  // 1. Happy path — current Unix-second timestamp, should verify and return event
  {
    const t = Math.floor(Date.now() / 1000);
    const header = makeHeader(BODY, SECRET, t);
    let event;
    try {
      event = await constructEvent(BODY, header, SECRET, { replayWindowSecs: 60 });
    } catch (err) {
      console.error("FAIL: happy path threw:", err);
      process.exit(1);
    }
    assert(event.type === "message.received", "happy path: event.type === 'message.received'");
    assert(event.data.message_id === "msg_1", "happy path: event.data.message_id === 'msg_1'");
    assert(event.data.account_id === "acc_1", "happy path: event.data.account_id === 'acc_1'");
  }

  // 2. Replay detection — timestamp 10 minutes in the past (600s > 300s default window)
  {
    const oldT = Math.floor(Date.now() / 1000) - 600;
    const header = makeHeader(BODY, SECRET, oldT);
    let caughtReason = null;
    try {
      await constructEvent(BODY, header, SECRET, { replayWindowSecs: 300 });
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        caughtReason = err.reason;
      } else {
        console.error("FAIL: replay threw unexpected error:", err);
        process.exit(1);
      }
    }
    assert(caughtReason === "replay_detected", `replay detection: reason === 'replay_detected' (got '${caughtReason}')`);
  }

  // 3. Future-skew guard — timestamp 10 minutes in the future
  {
    const futureT = Math.floor(Date.now() / 1000) + 600;
    const header = makeHeader(BODY, SECRET, futureT);
    let caughtReason = null;
    try {
      await constructEvent(BODY, header, SECRET, { replayWindowSecs: 300 });
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        caughtReason = err.reason;
      } else {
        console.error("FAIL: future-skew threw unexpected error:", err);
        process.exit(1);
      }
    }
    assert(caughtReason === "replay_detected", `future-skew guard: reason === 'replay_detected' (got '${caughtReason}')`);
  }

  // 4. Invalid signature
  {
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb`;
    let caughtReason = null;
    try {
      await constructEvent(BODY, header, SECRET, { replayWindowSecs: 300 });
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        caughtReason = err.reason;
      } else {
        console.error("FAIL: invalid sig threw unexpected error:", err);
        process.exit(1);
      }
    }
    assert(caughtReason === "invalid_signature", `invalid signature: reason === 'invalid_signature' (got '${caughtReason}')`);
  }

  // 5. Malformed header
  {
    let caughtReason = null;
    try {
      await constructEvent(BODY, "garbage", SECRET);
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        caughtReason = err.reason;
      } else {
        console.error("FAIL: malformed header threw unexpected error:", err);
        process.exit(1);
      }
    }
    assert(caughtReason === "malformed_header", `malformed header: reason === 'malformed_header' (got '${caughtReason}')`);
  }

  console.log("\nAll dist checks passed.");
}

main().catch((err) => {
  console.error("FAIL: unexpected error:", err);
  process.exit(1);
});
