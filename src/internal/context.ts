/**
 * Internal request context shared by every resource namespace.
 *
 * A `RequestContext` binds the resolved client config to a `request` function
 * and (optionally) a fixed `account_id` injected on every call — the mechanism
 * behind `curviate.account(id).<resource>`. Resources never touch the transport
 * directly; they call `ctx.request(...)`.
 *
 * Each resource takes a `RequestContext` and maps one method to one `/v1/*`
 * operation.
 */
import { execute, type HttpMethod } from "../transport.js";
import type { ResolvedConfig } from "../config.js";

/**
 * Where the account-scoped `account_id` is injected for this call.
 *
 * `account_id`'s location is per-endpoint and method-dependent:
 *   - `"body"`  — account-scoped write requests that carry a body declare
 *     `account_id` as a body field. The context writes it into the JSON object,
 *     or appends it as a form field when the body is `FormData` (multipart).
 *   - `"query"` — GET reads, body-less destructive verbs (DELETE), and
 *     filter-search POSTs (whose body is the filter set, with `account_id` in
 *     the query string) all carry it as a query parameter.
 *
 * Defaults to `"query"` so a method that omits it keeps the read-style location.
 */
export type AccountIdLocation = "body" | "query";

/** Per-call request shape passed by a resource method. */
export interface RequestArgs {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /**
   * Where to inject the context's fixed `account_id`. Defaults to `"query"`.
   * Methods whose endpoint requires `account_id` in the request body set
   * `"body"`; the context then routes it into the JSON object or appends it as
   * a `FormData` field, matching the body kind.
   */
  accountIdIn?: AccountIdLocation;
}

/** The bound caller a resource receives. */
export type RequestFn = <T = unknown>(args: RequestArgs) => Promise<T>;

export interface RequestContext {
  readonly request: RequestFn;
  /** The account id fixed by `account(id)`, or undefined for the root client. */
  readonly accountId: string | undefined;
}

/**
 * Inject `account_id` into a request body. For a `FormData` body it appends a
 * form field (multipart); for a plain object it adds a property (JSON). In both
 * cases a caller-supplied `account_id` already present wins and is not
 * overwritten. A `body` that is neither (absent, or a non-object such as a
 * primitive) is returned unchanged.
 */
function injectAccountIdIntoBody(body: unknown, accountId: string): unknown {
  if (body instanceof FormData) {
    if (!body.has("account_id")) body.append("account_id", accountId);
    return body;
  }
  if (body !== null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    // Caller-supplied account_id wins; never double-inject.
    return "account_id" in obj ? obj : { account_id: accountId, ...obj };
  }
  return body;
}

/**
 * Build a {@link RequestContext} from the resolved config. When `accountId` is
 * provided, it is injected into every request — into the query by default, or
 * into the body (JSON field / `FormData` field) for methods that declare
 * `accountIdIn: "body"`. A caller-supplied `account_id` always wins and is
 * never double-injected.
 */
export function createContext(
  config: ResolvedConfig,
  accountId?: string,
): RequestContext {
  const request: RequestFn = <T>(args: RequestArgs) => {
    const target: AccountIdLocation = args.accountIdIn ?? "query";

    let { query, body } = args;
    if (accountId !== undefined) {
      if (target === "body") {
        body = injectAccountIdIntoBody(body, accountId);
      } else {
        // Default: query. Caller-supplied query wins via the spread order.
        query = { account_id: accountId, ...args.query };
      }
    }

    return execute<T>(args.method, args.path, {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      ...(config.fetch ? { fetch: config.fetch } : {}),
      ...(query !== undefined ? { query } : {}),
      ...(body !== undefined ? { body } : {}),
    });
  };
  return { request, accountId };
}
