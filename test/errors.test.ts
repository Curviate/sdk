// CurviateError typed error model.
// constructEvent / WebhookSignatureError / CurviateEvent are
// covered in webhooks.constructEvent.test.ts.
import { describe, expect, it } from "vitest";
import {
  CurviateError,
  isCurviateError,
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
  // exhaustive presence of every observable code, and absence
  // of internal-only codes. A compile-time assignment proves the union accepts
  // the in-scope codes; the runtime check below guards against accidental drift.
  it("accepts every observable code (compile-time) and excludes internal codes", () => {
    const observable: ErrorCode[] = [
      "UNAUTHORIZED",
      "INVALID_REQUEST",
      "UNSUPPORTED_MEDIA_TYPE",
      "PAYLOAD_TOO_LARGE",
      "ACCOUNT_NOT_FOUND",
      "ACCOUNT_RESTRICTED",
      "ACCOUNT_ALREADY_LINKED",
      "RESOURCE_NOT_FOUND",
      "RESOURCE_ACCESS_RESTRICTED",
      "TIER_NOT_ACTIVE",
      "LINKEDIN_FEATURE_NOT_SUBSCRIBED",
      "RATE_LIMIT_ACCOUNT",
      "RATE_LIMIT_TENANT",
      "PLATFORM_RATE_LIMIT",
      "PLATFORM_ERROR",
      "PLATFORM_NOT_IMPLEMENTED",
      "CHECKPOINT_NOT_FOUND",
      "CHECKPOINT_EXPIRED",
      "CHECKPOINT_INVALID_CODE",
      "CHECKPOINT_MAX_ATTEMPTS",
      "CHECKPOINT_ALREADY_RESOLVED",
      "CHECKPOINT_UNSUPPORTED",
      "CONNECTION_IN_PROGRESS",
      "LINKEDIN_AUTH_FAILED",
      "LINKEDIN_RATE_LIMITED",
      "LINKEDIN_COOKIE_INVALID",
      "LINKEDIN_SERVICE_UNAVAILABLE",
      "MESSAGE_WINDOW_EXPIRED",
      "RECIPIENT_UNREACHABLE",
      "PAYMENT_REQUIRED",
      "PAYMENT_FAILED",
      "SUBSCRIPTION_BUSY",
      "SUBSCRIPTION_NOT_FOUND",
      "SEAT_NOT_FOUND",
      "SEAT_CANCELLED",
      "INTERNAL",
    ];
    // Every entry is a valid ErrorCode and a CurviateError can carry it.
    for (const code of observable) {
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
});
