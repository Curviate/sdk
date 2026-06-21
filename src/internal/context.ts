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

/** Per-call request shape passed by a resource method. */
export interface RequestArgs {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

/** The bound caller a resource receives. */
export type RequestFn = <T = unknown>(args: RequestArgs) => Promise<T>;

export interface RequestContext {
  readonly request: RequestFn;
  /** The account id fixed by `account(id)`, or undefined for the root client. */
  readonly accountId: string | undefined;
}

/**
 * Build a {@link RequestContext} from the resolved config. When `accountId` is
 * provided, it is merged into every request's query as `account_id` unless the
 * caller already supplied one explicitly.
 */
export function createContext(
  config: ResolvedConfig,
  accountId?: string,
): RequestContext {
  const request: RequestFn = <T>(args: RequestArgs) => {
    const query =
      accountId !== undefined
        ? { account_id: accountId, ...args.query }
        : args.query;
    return execute<T>(args.method, args.path, {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      ...(config.fetch ? { fetch: config.fetch } : {}),
      ...(query !== undefined ? { query } : {}),
      ...(args.body !== undefined ? { body: args.body } : {}),
    });
  };
  return { request, accountId };
}
