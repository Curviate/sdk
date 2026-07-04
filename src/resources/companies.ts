/**
 * Companies resource — 5 methods.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * `get()` accepts a public handle or numeric id (the retrieve's own broader
 * contract). `employees()` / `posts()` / `jobs()` / `followers()` require the
 * company's numeric provider_id only — the same `id` field `get()` returns.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip `account_id` from a query-param type (injected by the account-scoped context). */
type WithoutAccountId<T> = Omit<T, "account_id">;

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type CompanyProfile =
  paths["/v1/companies/{identifier}"]["get"]["responses"]["200"]["content"]["application/json"];

export type CompanyEmployeeListPage =
  paths["/v1/companies/{identifier}/employees"]["get"]["responses"]["200"]["content"]["application/json"];
/** Caller-facing query params for `companies.employees()` — `account_id` is injected by context. */
export type CompanyEmployeeListParams = WithoutAccountId<
  paths["/v1/companies/{identifier}/employees"]["get"]["parameters"]["query"]
>;

export type CompanyPostListPage =
  paths["/v1/companies/{identifier}/posts"]["get"]["responses"]["200"]["content"]["application/json"];
/** Caller-facing query params for `companies.posts()` — `account_id` is injected by context. */
export type CompanyPostListParams = WithoutAccountId<
  paths["/v1/companies/{identifier}/posts"]["get"]["parameters"]["query"]
>;

export type CompanyJobListPage =
  paths["/v1/companies/{identifier}/jobs"]["get"]["responses"]["200"]["content"]["application/json"];
/** Caller-facing query params for `companies.jobs()` — `account_id` is injected by context. */
export type CompanyJobListParams = WithoutAccountId<
  paths["/v1/companies/{identifier}/jobs"]["get"]["parameters"]["query"]
>;

export type CompanyFollowerListPage =
  paths["/v1/companies/{identifier}/followers"]["get"]["responses"]["200"]["content"]["application/json"];
/** Caller-facing query params for `companies.followers()` — `account_id` is injected by context. */
export type CompanyFollowerListParams = WithoutAccountId<
  paths["/v1/companies/{identifier}/followers"]["get"]["parameters"]["query"]
>;

// ─── Resource class ───────────────────────────────────────────────────────────

export class CompaniesResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Retrieve a company's full LinkedIn profile.
   * `GET /v1/companies/{identifier}`
   *
   * Accepts a public handle (the slug in `linkedin.com/company/<handle>`,
   * e.g. `t-systems`) or a numeric id (e.g. `1234567`). A URN is not accepted.
   * The `account_id` is injected by the account-scoped context.
   */
  get(identifier: string): Promise<CompanyProfile> {
    return this.ctx.request<CompanyProfile>({
      method: "GET",
      path: `/v1/companies/${identifier}`,
    });
  }

  /**
   * List people who currently work at the company.
   * `GET /v1/companies/{identifier}/employees`
   *
   * A facade over people search with the company filter applied — filter
   * further with `keywords` or `location`. `identifier` must be the
   * company's numeric provider_id (the same `id` field `get()` returns) —
   * a handle or URN is rejected before any upstream call.
   */
  employees(identifier: string, params?: CompanyEmployeeListParams): Promise<CompanyEmployeeListPage> {
    return this.ctx.request<CompanyEmployeeListPage>({
      method: "GET",
      path: `/v1/companies/${identifier}/employees`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * List the company's posts.
   * `GET /v1/companies/{identifier}/posts`
   *
   * A facade over post search with the company filter applied. `identifier`
   * must be the company's numeric provider_id.
   */
  posts(identifier: string, params?: CompanyPostListParams): Promise<CompanyPostListPage> {
    return this.ctx.request<CompanyPostListPage>({
      method: "GET",
      path: `/v1/companies/${identifier}/posts`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * List the company's open job postings.
   * `GET /v1/companies/{identifier}/jobs`
   *
   * A facade over job search with the company filter applied — filter
   * further with `keywords`. An empty `items[]` is a valid result (the
   * company currently has no open postings). `identifier` must be the
   * company's numeric provider_id.
   */
  jobs(identifier: string, params?: CompanyJobListParams): Promise<CompanyJobListPage> {
    return this.ctx.request<CompanyJobListPage>({
      method: "GET",
      path: `/v1/companies/${identifier}/jobs`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * List the company's followers.
   * `GET /v1/companies/{identifier}/followers`
   *
   * Native — reuses the same seam that backs `profiles.listFollowers()`.
   * You must be an administrator of the target company page.
   * `identifier` must be the company's numeric provider_id.
   */
  followers(identifier: string, params?: CompanyFollowerListParams): Promise<CompanyFollowerListPage> {
    return this.ctx.request<CompanyFollowerListPage>({
      method: "GET",
      path: `/v1/companies/${identifier}/followers`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }
}
