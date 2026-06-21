/**
 * Accounts resource — the reference vertical slice (sdk/001 AC-005).
 *
 * This is the copy-pattern for delegation 2's other resource namespaces:
 *   - take a {@link RequestContext} in the constructor,
 *   - map each method to exactly one `/v1/*` operation,
 *   - type request/response from the generated OpenAPI types (sdk/005 FR-006),
 *   - never re-declare a response interface by hand.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

/** `GET /v1/accounts` 200 body — a page of connected accounts plus a cursor. */
export type AccountListPage =
  paths["/v1/accounts"]["get"]["responses"]["200"]["content"]["application/json"];

/** `GET /v1/accounts` query params. */
export type AccountListParams = NonNullable<
  paths["/v1/accounts"]["get"]["parameters"]["query"]
>;

export class AccountsResource {
  constructor(private readonly ctx: RequestContext) {}

  /**
   * List the tenant's connected LinkedIn accounts, cursor-paginated.
   *
   * @param params - optional `limit` (1–250) and `cursor` (from a prior page).
   * @returns a page of accounts and the next-page `cursor` (null when exhausted).
   *
   * @example
   * const page = await curviate.accounts.list({ limit: 50 });
   * for (const acc of page.items ?? []) console.log(acc.account_id);
   */
  list(params?: AccountListParams): Promise<AccountListPage> {
    return this.ctx.request<AccountListPage>({
      method: "GET",
      path: "/v1/accounts",
      ...(params !== undefined ? { query: params } : {}),
    });
  }
}
