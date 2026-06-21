/**
 * Typed error model for the Curviate SDK (sdk/003 FR-001..FR-004).
 *
 * `CurviateError` is the single thrown type for every API-layer failure. Its
 * `code` is one of the stable, flat `ErrorCode` values — agent builders can
 * write an exhaustive `switch (error.code)` without fear of unknown codes.
 *
 * Credential safety (Hard Rule #2): a `CurviateError` never holds a reference
 * to the client or the apiKey, and its serialized form (`JSON.stringify`)
 * contains neither the key nor the `Bearer` scheme. The `message` is derived
 * from the API response body only.
 *
 * The webhook-receiving surface (`constructEvent`, `CurviateEvent`,
 * `WebhookSignatureError`, FR-005..007) is added separately.
 */

/**
 * The complete set of error codes observable by API callers.
 *
 * This union mirrors the server's error taxonomy (the customer-observable
 * subset). The string literals are copied here intentionally — the SDK has no
 * dependency on any private package. Internal-only codes that never reach a
 * caller (e.g. `BANNED_ENV_PREFIX`, `ADMIN_BYPASS`, protected-account and
 * substrate-internal codes) are deliberately excluded.
 *
 * The taxonomy is additive-only: new codes may be appended, existing ones are
 * never removed or renamed.
 */
export type ErrorCode =
  // Authentication / authorization
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  // Account state
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_RESTRICTED"
  | "RESOURCE_NOT_FOUND"
  // Tier / subscription gating
  | "TIER_NOT_ACTIVE"
  | "LINKEDIN_FEATURE_NOT_SUBSCRIBED"
  // Rate limits
  | "RATE_LIMIT_ACCOUNT"
  | "RATE_LIMIT_TENANT"
  | "PLATFORM_RATE_LIMIT"
  // Platform errors
  | "PLATFORM_ERROR"
  | "PLATFORM_NOT_IMPLEMENTED"
  // Checkpoint (account connect flow)
  | "CHECKPOINT_NOT_FOUND"
  | "CHECKPOINT_EXPIRED"
  | "CHECKPOINT_INVALID_CODE"
  | "CHECKPOINT_MAX_ATTEMPTS"
  | "CHECKPOINT_ALREADY_RESOLVED"
  | "CHECKPOINT_UNSUPPORTED"
  | "CONNECTION_IN_PROGRESS"
  // LinkedIn-specific connect errors
  | "LINKEDIN_AUTH_FAILED"
  | "LINKEDIN_RATE_LIMITED"
  | "LINKEDIN_COOKIE_INVALID"
  | "LINKEDIN_SERVICE_UNAVAILABLE"
  // Messaging mutation
  | "MESSAGE_WINDOW_EXPIRED"
  | "RECIPIENT_UNREACHABLE"
  // Billing (surface: tenant-management)
  | "PAYMENT_REQUIRED"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_BUSY"
  | "SUBSCRIPTION_NOT_FOUND"
  | "SEAT_NOT_FOUND"
  | "SEAT_CANCELLED"
  // Generic
  | "INTERNAL";

/**
 * The product tier a caller needs, surfaced on `TIER_NOT_ACTIVE` so an agent
 * can route an upgrade without parsing the message. `sn` and `sales_nav` are
 * both emitted by the API (internal flag key vs. product-facing label).
 */
export type RequiredTier = "core" | "sn" | "sales_nav" | "recruiter";

/** Structured retry guidance attached to retryable errors. */
export interface RetryHint {
  kind: "delay" | "backoff" | "never";
  delayMs?: number;
}

/** Constructor input for {@link CurviateError}. */
export interface CurviateErrorInit {
  code: ErrorCode;
  message: string;
  /** HTTP status from the response; `undefined` for network/transport errors. */
  httpStatus?: number;
  /** `null` when the API response carries no retry hint. */
  retryHint?: RetryHint | null;
  userFixable: boolean;
  retryLikelyToSucceed: boolean;
  /** Present on `TIER_NOT_ACTIVE` only. */
  requiredTier?: RequiredTier;
  /** Milliseconds to wait before retry, parsed from `Retry-After` (FR-007, sdk/004). */
  retryAfterMs?: number;
}

/** Plain-object shape produced by {@link CurviateError.toJSON}. */
export interface CurviateErrorJSON {
  name: "CurviateError";
  code: ErrorCode;
  message: string;
  httpStatus?: number;
  retryHint: RetryHint | null;
  userFixable: boolean;
  retryLikelyToSucceed: boolean;
  requiredTier?: RequiredTier;
  retryAfterMs?: number;
}

/**
 * The single thrown type for all Curviate API errors.
 *
 * @example
 * try {
 *   await curviate.accounts.list();
 * } catch (err) {
 *   if (isCurviateError(err) && err.code === "RATE_LIMIT_ACCOUNT") {
 *     await sleep(err.retryAfterMs ?? 1000);
 *   }
 * }
 */
export class CurviateError extends Error {
  override readonly name = "CurviateError";
  readonly code: ErrorCode;
  readonly httpStatus: number | undefined;
  readonly retryHint: RetryHint | null;
  readonly userFixable: boolean;
  readonly retryLikelyToSucceed: boolean;
  readonly requiredTier: RequiredTier | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(init: CurviateErrorInit) {
    super(init.message);
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.retryHint = init.retryHint ?? null;
    this.userFixable = init.userFixable;
    this.retryLikelyToSucceed = init.retryLikelyToSucceed;
    this.requiredTier = init.requiredTier;
    this.retryAfterMs = init.retryAfterMs;
    // Maintains a correct prototype chain when targeting ES5-class semantics.
    Object.setPrototypeOf(this, CurviateError.prototype);
  }

  /**
   * Explicit, credential-safe serialization (Hard Rule #2). Only the documented
   * structured fields are emitted — never a credential, auth header, or any
   * reference to the client. `JSON.stringify(error)` calls this automatically.
   */
  toJSON(): CurviateErrorJSON {
    const json: CurviateErrorJSON = {
      name: "CurviateError",
      code: this.code,
      message: this.message,
      retryHint: this.retryHint,
      userFixable: this.userFixable,
      retryLikelyToSucceed: this.retryLikelyToSucceed,
    };
    if (this.httpStatus !== undefined) json.httpStatus = this.httpStatus;
    if (this.requiredTier !== undefined) json.requiredTier = this.requiredTier;
    if (this.retryAfterMs !== undefined) json.retryAfterMs = this.retryAfterMs;
    return json;
  }
}

/**
 * Type guard for narrowing an unknown caught value to {@link CurviateError}.
 *
 * @example
 * catch (err) {
 *   if (isCurviateError(err)) { /* err.code is typed *\/ }
 * }
 */
export function isCurviateError(err: unknown): err is CurviateError {
  return err instanceof CurviateError;
}
