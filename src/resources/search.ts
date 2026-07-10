/**
 * Search resource — 6 methods.
 *
 * Account-scoped: the bound context injects `account_id` as the leading
 * `/v1/` path segment on every request (account-first grammar).
 *
 * Pagination (`offset`/`limit`/`cursor`) always stays a TOP-LEVEL query param
 * on every structured search op — never in the request body. Callers pass one
 * merged argument (filter body + optional `cursor`/`limit`/`offset`); the
 * method splits it into the query and the body on the wire.
 *
 * `fromUrl` is the sole home of URL-mode search — the structured
 * people/companies/posts/jobs endpoints no longer accept a `url` field.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type SearchParametersResult =
  paths["/v1/{account_id}/search/parameters"]["get"]["responses"]["200"]["content"]["application/json"];
export type SearchParametersQuery =
  paths["/v1/{account_id}/search/parameters"]["get"]["parameters"]["query"];

export type SearchPeopleBody =
  paths["/v1/{account_id}/search/people"]["post"]["requestBody"]["content"]["application/json"];
export type SearchPeopleQuery = NonNullable<
  paths["/v1/{account_id}/search/people"]["post"]["parameters"]["query"]
>;
export type SearchPeopleResult =
  paths["/v1/{account_id}/search/people"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchCompaniesBody =
  paths["/v1/{account_id}/search/companies"]["post"]["requestBody"]["content"]["application/json"];
export type SearchCompaniesQuery = NonNullable<
  paths["/v1/{account_id}/search/companies"]["post"]["parameters"]["query"]
>;
export type SearchCompaniesResult =
  paths["/v1/{account_id}/search/companies"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchPostsBody =
  paths["/v1/{account_id}/search/posts"]["post"]["requestBody"]["content"]["application/json"];
export type SearchPostsQuery = NonNullable<
  paths["/v1/{account_id}/search/posts"]["post"]["parameters"]["query"]
>;
export type SearchPostsResult =
  paths["/v1/{account_id}/search/posts"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchJobsBody =
  paths["/v1/{account_id}/search/jobs"]["post"]["requestBody"]["content"]["application/json"];
export type SearchJobsQuery = NonNullable<
  paths["/v1/{account_id}/search/jobs"]["post"]["parameters"]["query"]
>;
export type SearchJobsResult =
  paths["/v1/{account_id}/search/jobs"]["post"]["responses"]["200"]["content"]["application/json"];

export type SearchFromUrlBody =
  paths["/v1/{account_id}/search"]["post"]["requestBody"]["content"]["application/json"];
export type SearchFromUrlQuery = NonNullable<
  paths["/v1/{account_id}/search"]["post"]["parameters"]["query"]
>;
export type SearchFromUrlResult =
  paths["/v1/{account_id}/search"]["post"]["responses"]["200"]["content"]["application/json"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Split a merged body+pagination argument into its `query` and `body` wire parts. */
function splitPagination<TBody extends Record<string, unknown>>(
  merged: TBody & { cursor?: string; limit?: number; offset?: number },
): {
  body: Omit<TBody, "cursor" | "limit" | "offset">;
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
} {
  const { cursor, limit, offset, ...body } = merged;
  const hasQuery = cursor !== undefined || limit !== undefined || offset !== undefined;
  return {
    body,
    ...(hasQuery
      ? {
          query: {
            ...(cursor !== undefined ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
            ...(offset !== undefined ? { offset } : {}),
          },
        }
      : {}),
  };
}

// ─── Resource class ───────────────────────────────────────────────────────────

export class SearchResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Resolve human-readable terms to opaque filter IDs for structured search.
   * `GET /v1/{account_id}/search/parameters`
   */
  getParameters(query: SearchParametersQuery): Promise<SearchParametersResult> {
    return this.ctx.request<SearchParametersResult>({
      method: "GET",
      path: "/v1/{account_id}/search/parameters",
      query: query as Record<string, string | number | boolean | string[] | undefined | null>,
    });
  }

  /**
   * Search people with structured filters.
   * `POST /v1/{account_id}/search/people`
   * `offset`/`limit`/`cursor` are top-level query params, never in the body.
   */
  people(body: SearchPeopleBody & SearchPeopleQuery): Promise<SearchPeopleResult> {
    const split = splitPagination(body);
    return this.ctx.request<SearchPeopleResult>({
      method: "POST",
      path: "/v1/{account_id}/search/people",
      body: split.body,
      ...(split.query ? { query: split.query } : {}),
    });
  }

  /**
   * Search companies with structured filters.
   * `POST /v1/{account_id}/search/companies`
   */
  companies(body: SearchCompaniesBody & SearchCompaniesQuery): Promise<SearchCompaniesResult> {
    const split = splitPagination(body);
    return this.ctx.request<SearchCompaniesResult>({
      method: "POST",
      path: "/v1/{account_id}/search/companies",
      body: split.body,
      ...(split.query ? { query: split.query } : {}),
    });
  }

  /**
   * Search posts with structured filters.
   * `POST /v1/{account_id}/search/posts`
   */
  posts(body: SearchPostsBody & SearchPostsQuery): Promise<SearchPostsResult> {
    const split = splitPagination(body);
    return this.ctx.request<SearchPostsResult>({
      method: "POST",
      path: "/v1/{account_id}/search/posts",
      body: split.body,
      ...(split.query ? { query: split.query } : {}),
    });
  }

  /**
   * Search jobs with structured filters.
   * `POST /v1/{account_id}/search/jobs`
   */
  jobs(body: SearchJobsBody & SearchJobsQuery): Promise<SearchJobsResult> {
    const split = splitPagination(body);
    return this.ctx.request<SearchJobsResult>({
      method: "POST",
      path: "/v1/{account_id}/search/jobs",
      body: split.body,
      ...(split.query ? { query: split.query } : {}),
    });
  }

  /**
   * Run a pasted LinkedIn search/saved-search/lead-list URL directly.
   * `POST /v1/{account_id}/search`
   * `url` is the ONLY accepted body field — the sole home of URL-mode search;
   * the structured endpoints above no longer accept `url`. The response is
   * polymorphic, each item discriminated individually by its own `object`.
   */
  fromUrl(body: SearchFromUrlBody & SearchFromUrlQuery): Promise<SearchFromUrlResult> {
    const { cursor, limit, offset, url } = body;
    const hasQuery = cursor !== undefined || limit !== undefined || offset !== undefined;
    return this.ctx.request<SearchFromUrlResult>({
      method: "POST",
      path: "/v1/{account_id}/search",
      body: { url },
      ...(hasQuery
        ? {
            query: {
              ...(cursor !== undefined ? { cursor } : {}),
              ...(limit !== undefined ? { limit } : {}),
              ...(offset !== undefined ? { offset } : {}),
            },
          }
        : {}),
    });
  }
}
