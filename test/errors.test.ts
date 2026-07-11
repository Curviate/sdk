// CurviateError typed error model.
// constructEvent / WebhookSignatureError / CurviateEvent are
// covered in webhooks.constructEvent.test.ts.
import { describe, expect, it } from "vitest";
import {
  CurviateError,
  isCurviateError,
  ERROR_CODES,
  KNOWN_ERROR_CODES,
  type ErrorCode,
} from "../src/errors.js";

describe("CurviateError", () => {
  // instanceof Error and CurviateError; code is carried.
  it("is an instance of both Error and CurviateError and carries its code", () => {
    const e = new CurviateError({
      code: "UNAUTHORIZED",
      message: "x",
      httpStatus: 401,
      userFixable: false,
      retryLikelyToSucceed: false,
    });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CurviateError);
    expect(e.code).toBe("UNAUTHORIZED");
    expect(e.httpStatus).toBe(401);
    expect(e.name).toBe("CurviateError");
  });

  // full field surface.
  it("exposes the documented field surface", () => {
    const e = new CurviateError({
      code: "TIER_NOT_ACTIVE",
      message: "needs sales nav",
      httpStatus: 403,
      userFixable: true,
      retryLikelyToSucceed: false,
      requiredTier: "sales_nav",
      retryHint: { kind: "never" },
    });
    expect(e.userFixable).toBe(true);
    expect(e.retryLikelyToSucceed).toBe(false);
    expect(e.requiredTier).toBe("sales_nav");
    expect(e.retryHint).toEqual({ kind: "never" });
  });

  // network errors map to INTERNAL with no httpStatus.
  it("supports a network-error shape (INTERNAL, undefined httpStatus)", () => {
    const e = new CurviateError({
      code: "INTERNAL",
      message: "Network error",
      userFixable: false,
      retryLikelyToSucceed: true,
    });
    expect(e.code).toBe("INTERNAL");
    expect(e.httpStatus).toBeUndefined();
    expect(e.retryHint).toBeNull();
  });

  // the credential never appears in the serialized error, and neither does the literal "Bearer".
  it("never serializes the apiKey or the Bearer scheme", () => {
    const apiKey = "my_secret_api_key";
    // Construct an error the way the transport would on a 401, with a message
    // derived from the response body only — never from the auth header.
    const e = new CurviateError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key.",
      httpStatus: 401,
      userFixable: false,
      retryLikelyToSucceed: false,
    });
    const serialized = JSON.stringify(e);
    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain("Bearer");
    // And the structured fields a caller relies on survive serialization.
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed["code"]).toBe("UNAUTHORIZED");
    expect(parsed["message"]).toBe("Invalid or missing API key.");
    expect(parsed["httpStatus"]).toBe(401);
  });

  // even if a caller were to stuff the key into the message (which the
  // transport never does), toJSON must not widen the surface to include an
  // apiKey/authorization field. We assert the shape has no such key.
  it("toJSON exposes no credential-bearing field", () => {
    const e = new CurviateError({
      code: "INTERNAL",
      message: "boom",
      userFixable: false,
      retryLikelyToSucceed: true,
    });
    const json = e.toJSON();
    expect(Object.keys(json)).not.toContain("apiKey");
    expect(Object.keys(json)).not.toContain("authorization");
    expect(Object.keys(json)).not.toContain("headers");
  });
});

describe("isCurviateError", () => {
  it("returns true for a CurviateError", () => {
    const e = new CurviateError({
      code: "INTERNAL",
      message: "x",
      userFixable: false,
      retryLikelyToSucceed: true,
    });
    expect(isCurviateError(e)).toBe(true);
  });

  it("returns false for a plain Error", () => {
    expect(isCurviateError(new Error("plain"))).toBe(false);
  });

  it("returns false for null and non-objects", () => {
    expect(isCurviateError(null)).toBe(false);
    expect(isCurviateError(undefined)).toBe(false);
    expect(isCurviateError("UNAUTHORIZED")).toBe(false);
    expect(isCurviateError({ code: "UNAUTHORIZED" })).toBe(false);
  });
});

describe("ErrorCode union", () => {
  // Every code in the taxonomy is a valid ErrorCode a CurviateError can carry,
  // and internal-only codes are excluded from the public union. Iterating
  // ERROR_CODES (rather than a hand-copied list) means this test can never
  // drift from the actual taxonomy.
  it("carries every taxonomy code and excludes internal codes", () => {
    for (const code of ERROR_CODES) {
      expect(new CurviateError({
        code,
        message: "x",
        userFixable: false,
        retryLikelyToSucceed: false,
      }).code).toBe(code);
    }

    // @ts-expect-error — internal-only code is excluded from the public union.
    const banned1: ErrorCode = "BANNED_ENV_PREFIX";
    // @ts-expect-error — internal-only code is excluded from the public union.
    const banned2: ErrorCode = "ADMIN_BYPASS";
    // @ts-expect-error — fabricated code is not in the union.
    const banned3: ErrorCode = "BANISHED_CODE";
    void banned1;
    void banned2;
    void banned3;
  });

  // The connect-request conflict code is part of the public taxonomy — a caller
  // can narrow on it in an exhaustive switch.
  it("includes CONNECTION_REQUEST_CONFLICT in the taxonomy", () => {
    expect(ERROR_CODES).toContain("CONNECTION_REQUEST_CONFLICT");
  });
});

describe("error-code single source of truth", () => {
  // The runtime membership set and the ErrorCode type are BOTH derived from
  // ERROR_CODES, so a code can never be recognized by the type but not the
  // runtime decoder (the drift that downgraded CONNECTION_REQUEST_CONFLICT to
  // INTERNAL). These assertions lock that derivation in place.
  it("KNOWN_ERROR_CODES contains exactly the ERROR_CODES entries", () => {
    expect(new Set(KNOWN_ERROR_CODES)).toEqual(new Set(ERROR_CODES));
  });

  it("has no duplicate entries in ERROR_CODES", () => {
    expect(KNOWN_ERROR_CODES.size).toBe(ERROR_CODES.length);
  });

  it("recognizes every taxonomy code at runtime", () => {
    for (const code of ERROR_CODES) {
      expect(KNOWN_ERROR_CODES.has(code)).toBe(true);
    }
  });
});

// Compile-time lock: the ErrorCode type and the ERROR_CODES element type must
// stay identical. The tuple wrappers defeat union distribution so this is a
// strict equality — if a future change decouples the type from the array (e.g.
// by reverting to a hand-listed union), this stops type-checking.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _errorCodeMatchesArray: Same<ErrorCode, (typeof ERROR_CODES)[number]> = true;
void _errorCodeMatchesArray;
