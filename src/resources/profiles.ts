/**
 * Profiles resource — 9 methods.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * Methods that have `account_id` in their query params omit it from the
 * caller-facing type — the context injects it transparently.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip `account_id` from a query-param type (injected by the account-scoped context). */
type WithoutAccountId<T> = Omit<T, "account_id">;

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type ProfileDetail =
  paths["/v1/profiles/me"]["get"]["responses"]["200"]["content"]["application/json"];

export type ProfileGetResult =
  paths["/v1/profiles/{profile_id}"]["get"]["responses"]["200"]["content"]["application/json"];
/** Caller-facing query params for `profiles.get()` — `account_id` is injected by context. */
export type ProfileGetParams = WithoutAccountId<
  paths["/v1/profiles/{profile_id}"]["get"]["parameters"]["query"]
>;

export type ConnectionListPage =
  paths["/v1/profiles/relations"]["get"]["responses"]["200"]["content"]["application/json"];
export type ConnectionListParams = WithoutAccountId<
  paths["/v1/profiles/relations"]["get"]["parameters"]["query"]
>;

export type FollowerListPage =
  paths["/v1/profiles/{profile_id}/followers"]["get"]["responses"]["200"]["content"]["application/json"];
export type FollowerListParams = WithoutAccountId<
  NonNullable<paths["/v1/profiles/{profile_id}/followers"]["get"]["parameters"]["query"]>
>;

export type ProfilePostListPage =
  paths["/v1/profiles/{profile_id}/posts"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProfilePostListParams = WithoutAccountId<
  NonNullable<paths["/v1/profiles/{profile_id}/posts"]["get"]["parameters"]["query"]>
>;

export type ProfileCommentListPage =
  paths["/v1/profiles/{profile_id}/comments"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProfileCommentListParams = WithoutAccountId<
  NonNullable<paths["/v1/profiles/{profile_id}/comments"]["get"]["parameters"]["query"]>
>;

export type ProfileReactionListPage =
  paths["/v1/profiles/{profile_id}/reactions"]["get"]["responses"]["200"]["content"]["application/json"];
export type ProfileReactionListParams = WithoutAccountId<
  NonNullable<paths["/v1/profiles/{profile_id}/reactions"]["get"]["parameters"]["query"]>
>;

export type CompanyProfile =
  paths["/v1/profiles/companies/{company_id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type EndorseBody =
  paths["/v1/profiles/{profile_id}/endorse"]["post"]["requestBody"]["content"]["application/json"];
export type EndorseResult =
  paths["/v1/profiles/{profile_id}/endorse"]["post"]["responses"]["200"]["content"]["application/json"];

// ─── Resource class ───────────────────────────────────────────────────────────

export class ProfilesResource {
  constructor(protected readonly ctx: RequestContext) {}

  /** Get the account's own LinkedIn profile. `GET /v1/profiles/me` */
  getMe(): Promise<ProfileDetail> {
    return this.ctx.request<ProfileDetail>({
      method: "GET",
      path: "/v1/profiles/me",
    });
  }

  /**
   * Get a LinkedIn member profile by id or public handle.
   * `GET /v1/profiles/{profile_id}`
   * Pass `{ notify: true }` to signal a profile view.
   * The `account_id` is injected by the account-scoped context.
   */
  get(profileId: string, params?: ProfileGetParams): Promise<ProfileGetResult> {
    return this.ctx.request<ProfileGetResult>({
      method: "GET",
      path: `/v1/profiles/${profileId}`,
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /** List the account's 1st-degree connections. `GET /v1/profiles/relations` */
  listConnections(params?: ConnectionListParams): Promise<ConnectionListPage> {
    return this.ctx.request<ConnectionListPage>({
      method: "GET",
      path: "/v1/profiles/relations",
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /** List a profile's followers. `GET /v1/profiles/{profile_id}/followers` */
  listFollowers(profileId: string, params?: FollowerListParams): Promise<FollowerListPage> {
    return this.ctx.request<FollowerListPage>({
      method: "GET",
      path: `/v1/profiles/${profileId}/followers`,
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /**
   * List a profile's posts. `GET /v1/profiles/{profile_id}/posts`
   * Pass `{ is_company: true }` for company posts.
   */
  listPosts(profileId: string, params?: ProfilePostListParams): Promise<ProfilePostListPage> {
    return this.ctx.request<ProfilePostListPage>({
      method: "GET",
      path: `/v1/profiles/${profileId}/posts`,
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /** List a profile's comments. `GET /v1/profiles/{profile_id}/comments` */
  listComments(profileId: string, params?: ProfileCommentListParams): Promise<ProfileCommentListPage> {
    return this.ctx.request<ProfileCommentListPage>({
      method: "GET",
      path: `/v1/profiles/${profileId}/comments`,
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /** List a profile's reactions. `GET /v1/profiles/{profile_id}/reactions` */
  listReactions(profileId: string, params?: ProfileReactionListParams): Promise<ProfileReactionListPage> {
    return this.ctx.request<ProfileReactionListPage>({
      method: "GET",
      path: `/v1/profiles/${profileId}/reactions`,
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /** Get a company profile. `GET /v1/profiles/companies/{company_id}` */
  getCompany(companyId: string): Promise<CompanyProfile> {
    return this.ctx.request<CompanyProfile>({
      method: "GET",
      path: `/v1/profiles/companies/${companyId}`,
    });
  }

  /** Endorse a skill on a profile. `POST /v1/profiles/{profile_id}/endorse` */
  endorse(profileId: string, body: EndorseBody): Promise<EndorseResult> {
    return this.ctx.request<EndorseResult>({
      method: "POST",
      path: `/v1/profiles/${profileId}/endorse`,
      body,
    });
  }
}
