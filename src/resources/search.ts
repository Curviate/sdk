/**
 * Search resource — 5 methods.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * Cursor pagination passes `cursor` as a query param (GET) or in the body (POST).
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type SearchParametersResult =
  paths["/v1/search/parameters"]["get"]["responses"]["200"]["content"]["application/json"];
export type SearchParametersQuery =
  paths["/v1/search/parameters"]["get"]["parameters"]["query"];

export type SearchPeopleBody =
  paths["/v1/search/people"]["post"]["requestBody"]["content"]["application/json"];
export type SearchPeopleQuery = NonNullable<
  paths["/v1/search/people"]["post"]["parameters"]["query"]
>;
export type SearchPeopleResult =
  paths["/v1/search/people"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchCompaniesBody =
  paths["/v1/search/companies"]["post"]["requestBody"]["content"]["application/json"];
export type SearchCompaniesResult =
  paths["/v1/search/companies"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchPostsBody =
  paths["/v1/search/posts"]["post"]["requestBody"]["content"]["application/json"];
export type SearchPostsResult =
  paths["/v1/search/posts"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchJobsBody =
  paths["/v1/search/jobs"]["post"]["requestBody"]["content"]["application/json"];
export type SearchJobsResult =
  paths["/v1/search/jobs"]["post"]["responses"]["200"]["content"]["application/json"];

// ─── Resource class ───────────────────────────────────────────────────────────

export class SearchResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Resolve human-readable terms to opaque filter IDs for structured search.
   * `GET /v1/search/parameters`
   */
  getParameters(query: SearchParametersQuery): Promise<SearchParametersResult> {
    return this.ctx.request<SearchParametersResult>({
      method: "GET",
      path: "/v1/search/parameters",
      query,
    });
  }

  /**
   * Search LinkedIn people with structured filters or a pasted URL.
   * `POST /v1/search/people`
   * Cursor passed via query param (not body) — matches the OpenAPI spec.
   */
  people(body: SearchPeopleBody & { cursor?: string; limit?: number }): Promise<SearchPeopleResult> {
    const { cursor, limit, ...rest } = body;
    return this.ctx.request<SearchPeopleResult>({
      method: "POST",
      path: "/v1/search/people",
      body: rest,
      ...(cursor !== undefined || limit !== undefined
        ? { query: { ...(cursor !== undefined ? { cursor } : {}), ...(limit !== undefined ? { limit } : {}) } }
        : {}),
    });
  }

  /**
   * Search LinkedIn companies.
   * `POST /v1/search/companies`
   */
  companies(body: SearchCompaniesBody & { cursor?: string; limit?: number }): Promise<SearchCompaniesResult> {
    const { cursor, limit, ...rest } = body;
    return this.ctx.request<SearchCompaniesResult>({
      method: "POST",
      path: "/v1/search/companies",
      body: rest,
      ...(cursor !== undefined || limit !== undefined
        ? { query: { ...(cursor !== undefined ? { cursor } : {}), ...(limit !== undefined ? { limit } : {}) } }
        : {}),
    });
  }

  /**
   * Search LinkedIn posts.
   * `POST /v1/search/posts`
   */
  posts(body: SearchPostsBody & { cursor?: string; limit?: number }): Promise<SearchPostsResult> {
    const { cursor, limit, ...rest } = body;
    return this.ctx.request<SearchPostsResult>({
      method: "POST",
      path: "/v1/search/posts",
      body: rest,
      ...(cursor !== undefined || limit !== undefined
        ? { query: { ...(cursor !== undefined ? { cursor } : {}), ...(limit !== undefined ? { limit } : {}) } }
        : {}),
    });
  }

  /**
   * Search LinkedIn jobs.
   * `POST /v1/search/jobs`
   */
  jobs(body: SearchJobsBody & { cursor?: string; limit?: number }): Promise<SearchJobsResult> {
    const { cursor, limit, ...rest } = body;
    return this.ctx.request<SearchJobsResult>({
      method: "POST",
      path: "/v1/search/jobs",
      body: rest,
      ...(cursor !== undefined || limit !== undefined
        ? { query: { ...(cursor !== undefined ? { cursor } : {}), ...(limit !== undefined ? { limit } : {}) } }
        : {}),
    });
  }
}
