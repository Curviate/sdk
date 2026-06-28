/**
 * Sales Navigator resource — 7 methods (tier: sn).
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * `startChat` accepts optional `attachments: Array<Buffer | File>` and builds
 * `FormData` automatically before calling the transport.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type SNSearchPeopleBody =
  paths["/v1/sales-navigator/search/people"]["post"]["requestBody"]["content"]["application/json"];
export type SNSearchPeopleParams = NonNullable<
  paths["/v1/sales-navigator/search/people"]["post"]["parameters"]["query"]
>;
export type SNSearchPeopleResult =
  paths["/v1/sales-navigator/search/people"]["post"]["responses"]["200"]["content"]["application/json"];

export type SNSearchCompaniesBody =
  paths["/v1/sales-navigator/search/companies"]["post"]["requestBody"]["content"]["application/json"];
export type SNSearchCompaniesParams = NonNullable<
  paths["/v1/sales-navigator/search/companies"]["post"]["parameters"]["query"]
>;
export type SNSearchCompaniesResult =
  paths["/v1/sales-navigator/search/companies"]["post"]["responses"]["200"]["content"]["application/json"];

export type SNGetParametersParams = NonNullable<
  paths["/v1/sales-navigator/search/parameters"]["get"]["parameters"]["query"]
>;
export type SNGetParametersResult =
  paths["/v1/sales-navigator/search/parameters"]["get"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/sales-navigator/chats` multipart/form-data fields (non-file scalars). */
type StartChatFormFields =
  paths["/v1/sales-navigator/chats"]["post"]["requestBody"]["content"]["multipart/form-data"];
/**
 * Caller-facing body: scalar fields plus optional `attachments`, `voice_message`,
 * and `video_message` (the SDK builds `FormData` internally when files are present).
 * `account_id` is optional because the account-scoped context injects it.
 */
export type SNStartChatBody = Omit<
  StartChatFormFields,
  "account_id" | "attachments" | "voice_message" | "video_message"
> & {
  account_id?: string;
  attachments?: Array<Buffer | File>;
  voice_message?: Buffer | File;
  video_message?: Buffer | File;
};
export type SNStartChatResult =
  paths["/v1/sales-navigator/chats"]["post"]["responses"]["201"]["content"]["application/json"];

export type SNGetProfileParams = NonNullable<
  paths["/v1/sales-navigator/profiles/{identifier}"]["get"]["parameters"]["query"]
>;
export type SNGetProfileResult =
  paths["/v1/sales-navigator/profiles/{identifier}"]["get"]["responses"]["200"]["content"]["application/json"];

export type SNSaveLeadBody =
  paths["/v1/sales-navigator/leads/{user_id}"]["post"]["requestBody"]["content"]["application/json"];
export type SNSaveLeadResult =
  paths["/v1/sales-navigator/leads/{user_id}"]["post"]["responses"]["200"]["content"]["application/json"];

export type SNSyncMessagesParams = NonNullable<
  paths["/v1/sales-navigator/messages/sync"]["get"]["parameters"]["query"]
>;
export type SNSyncMessagesResult =
  paths["/v1/sales-navigator/messages/sync"]["get"]["responses"]["200"]["content"]["application/json"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFormData(
  scalars: Record<string, unknown>,
  attachments?: Array<Buffer | File>,
  voice_message?: Buffer | File,
  video_message?: Buffer | File,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(scalars)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          form.append(key, String(item));
        }
      } else {
        form.append(key, String(value));
      }
    }
  }
  for (const attachment of attachments ?? []) {
    if (attachment instanceof File) {
      form.append("attachments", attachment);
    } else {
      form.append("attachments", new Blob([attachment as unknown as BlobPart]));
    }
  }
  if (voice_message) {
    if (voice_message instanceof File) {
      form.append("voice_message", voice_message);
    } else {
      form.append("voice_message", new Blob([voice_message as unknown as BlobPart]));
    }
  }
  if (video_message) {
    if (video_message instanceof File) {
      form.append("video_message", video_message);
    } else {
      form.append("video_message", new Blob([video_message as unknown as BlobPart]));
    }
  }
  return form;
}

// ─── Resource class ───────────────────────────────────────────────────────────

export class SalesNavigatorResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Search LinkedIn members using the full Sales Navigator filter set.
   * `POST /v1/sales-navigator/search/people`
   * Requires tier `sn`. Returns `TIER_NOT_ACTIVE` (403) when the seat lacks it.
   */
  searchPeople(body: SNSearchPeopleBody, params?: Partial<SNSearchPeopleParams>): Promise<SNSearchPeopleResult> {
    return this.ctx.request<SNSearchPeopleResult>({
      method: "POST",
      path: "/v1/sales-navigator/search/people",
      body,
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Search LinkedIn companies using the full Sales Navigator company filter set.
   * `POST /v1/sales-navigator/search/companies`
   */
  searchCompanies(body: SNSearchCompaniesBody, params?: Partial<SNSearchCompaniesParams>): Promise<SNSearchCompaniesResult> {
    return this.ctx.request<SNSearchCompaniesResult>({
      method: "POST",
      path: "/v1/sales-navigator/search/companies",
      body,
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Resolve human-readable terms to opaque Sales Navigator filter IDs.
   * `GET /v1/sales-navigator/search/parameters`
   */
  getParameters(params: SNGetParametersParams): Promise<SNGetParametersResult> {
    return this.ctx.request<SNGetParametersResult>({
      method: "GET",
      path: "/v1/sales-navigator/search/parameters",
      query: params,
    });
  }

  /**
   * Start a new Sales Navigator chat. Accepts optional `attachments[]`,
   * `voice_message`, and `video_message` — when present, the request is sent
   * as `multipart/form-data`. `POST /v1/sales-navigator/chats`
   */
  startChat(body: SNStartChatBody): Promise<SNStartChatResult> {
    const { attachments, voice_message, video_message, ...scalars } = body;
    const hasFiles =
      (attachments && attachments.length > 0) || voice_message || video_message;
    if (hasFiles) {
      return this.ctx.request<SNStartChatResult>({
        method: "POST",
        path: "/v1/sales-navigator/chats",
        body: buildFormData(
          scalars as Record<string, unknown>,
          attachments,
          voice_message,
          video_message,
        ),
        accountIdIn: "body",
      });
    }
    return this.ctx.request<SNStartChatResult>({
      method: "POST",
      path: "/v1/sales-navigator/chats",
      body: scalars,
      accountIdIn: "body",
    });
  }

  /**
   * Retrieve a LinkedIn profile with Sales Navigator enrichment.
   * `GET /v1/sales-navigator/profiles/{identifier}`
   */
  getProfile(identifier: string, params?: Partial<SNGetProfileParams>): Promise<SNGetProfileResult> {
    return this.ctx.request<SNGetProfileResult>({
      method: "GET",
      path: `/v1/sales-navigator/profiles/${identifier}`,
      // cast needed: linkedin_sections is string[] but transport encodes arrays as repeated params
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * Save a Sales Navigator member as a lead. `POST /v1/sales-navigator/leads/{user_id}`
   */
  saveLead(userId: string, body: SNSaveLeadBody): Promise<SNSaveLeadResult> {
    return this.ctx.request<SNSaveLeadResult>({
      method: "POST",
      path: `/v1/sales-navigator/leads/${userId}`,
      body,
      accountIdIn: "body",
    });
  }

  /**
   * Trigger a re-sync of the account's Sales Navigator message history.
   * `GET /v1/sales-navigator/messages/sync`
   */
  syncMessages(params: SNSyncMessagesParams): Promise<SNSyncMessagesResult> {
    return this.ctx.request<SNSyncMessagesResult>({
      method: "GET",
      path: "/v1/sales-navigator/messages/sync",
      query: params,
    });
  }
}
