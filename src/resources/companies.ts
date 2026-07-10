/**
 * Companies resource — 4 methods.
 *
 * Account-scoped: the bound context injects `account_id` as the leading
 * `/v1/` path segment on every request (account-first grammar) — the 0.14.1
 * query-param `account_id` is dropped entirely.
 *
 * `get()` accepts a public handle or numeric id (the retrieve's own broader
 * contract). `employees()` / `posts()` / `jobs()` require the company's
 * numeric provider_id only — the same `id` field `get()` returns.
 *
 * `followers` has no served equivalent — REMOVED; `get()`'s `follower_count`
 * field is the audience-size signal that replaces it.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type CompanyProfile =
  paths["/v1/{account_id}/companies/{identifier}"]["get"]["responses"]["200"]["content"]["application/json"];

export type CompanyEmployeeListPage =
  paths["/v1/{account_id}/companies/{identifier}/employees"]["get"]["responses"]["200"]["content"]["application/json"];
export type CompanyEmployeeListQuery = NonNullable<
  paths["/v1/{account_id}/companies/{identifier}/employees"]["get"]["parameters"]["query"]
>;

export type CompanyPostListPage =
  paths["/v1/{account_id}/companies/{identifier}/posts"]["get"]["responses"]["200"]["content"]["application/json"];
export type CompanyPostListQuery = NonNullable<
  paths["/v1/{account_id}/companies/{identifier}/posts"]["get"]["parameters"]["query"]
>;

export type CompanyJobListPage =
  paths["/v1/{account_id}/companies/{identifier}/jobs"]["get"]["responses"]["200"]["content"]["application/json"];
export type CompanyJobListQuery = NonNullable<
  paths["/v1/{account_id}/companies/{identifier}/jobs"]["get"]["parameters"]["query"]
>;

// ─── Resource class ───────────────────────────────────────────────────────────

export class CompaniesResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Retrieve a company's full LinkedIn profile.
   * `GET /v1/{account_id}/companies/{identifier}`
   *
   * Accepts a public handle (the slug in `linkedin.com/company/<handle>`,
   * e.g. `t-systems`) or a numeric id (e.g. `1234567`). A URN is not accepted.
   */
  get(identifier: string): Promise<CompanyProfile> {
    return this.ctx.request<CompanyProfile>({
      method: "GET",
      path: `/v1/{account_id}/companies/${identifier}`,
    });
  }

  /**
   * List people who currently work at the company.
   * `GET /v1/{account_id}/companies/{identifier}/employees`
   *
   * A facade over people search with the company filter applied — filter
   * further with `keywords` or `location`. `identifier` must be the
   * company's numeric provider_id (the same `id` field `get()` returns) —
   * a handle or URN is rejected before any upstream call.
   */
  employees(identifier: string, params?: CompanyEmployeeListQuery): Promise<CompanyEmployeeListPage> {
    return this.ctx.request<CompanyEmployeeListPage>({
      method: "GET",
      path: `/v1/{account_id}/companies/${identifier}/employees`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * List the company's posts.
   * `GET /v1/{account_id}/companies/{identifier}/posts`
   *
   * A facade over post search with the company filter applied. `identifier`
   * must be the company's numeric provider_id.
   */
  posts(identifier: string, params?: CompanyPostListQuery): Promise<CompanyPostListPage> {
    return this.ctx.request<CompanyPostListPage>({
      method: "GET",
      path: `/v1/{account_id}/companies/${identifier}/posts`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * List the company's open job postings.
   * `GET /v1/{account_id}/companies/{identifier}/jobs`
   *
   * A facade over job search with the company filter applied — filter
   * further with `keywords`. An empty `items[]` is a valid result (the
   * company currently has no open postings). `identifier` must be the
   * company's numeric provider_id.
   */
  jobs(identifier: string, params?: CompanyJobListQuery): Promise<CompanyJobListPage> {
    return this.ctx.request<CompanyJobListPage>({
      method: "GET",
      path: `/v1/{account_id}/companies/${identifier}/jobs`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }
}
