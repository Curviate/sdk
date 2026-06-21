/**
 * Invites resource — 5 methods.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type SendInviteBody =
  paths["/v1/invites"]["post"]["requestBody"]["content"]["application/json"];
/** `POST /v1/invites` returns 200 (already_* states) or 201 (sent). Both shapes share this union. */
export type SendInviteResult =
  | paths["/v1/invites"]["post"]["responses"]["200"]["content"]["application/json"]
  | paths["/v1/invites"]["post"]["responses"]["201"]["content"]["application/json"];

export type SentInviteListPage =
  paths["/v1/invites/sent"]["get"]["responses"]["200"]["content"]["application/json"];
export type SentInviteListParams = Omit<
  paths["/v1/invites/sent"]["get"]["parameters"]["query"],
  "account_id"
>;

export type ReceivedInviteListPage =
  paths["/v1/invites/received"]["get"]["responses"]["200"]["content"]["application/json"];
export type ReceivedInviteListParams = Omit<
  paths["/v1/invites/received"]["get"]["parameters"]["query"],
  "account_id"
>;

export type RespondInviteBody =
  paths["/v1/invites/received/{invitation_id}"]["post"]["requestBody"]["content"]["application/json"];
export type RespondInviteResult =
  paths["/v1/invites/received/{invitation_id}"]["post"]["responses"]["200"]["content"]["application/json"];

export type CancelInviteResult =
  paths["/v1/invites/{invitation_id}"]["delete"]["responses"]["200"]["content"]["application/json"];

// ─── Resource class ───────────────────────────────────────────────────────────

export class InvitesResource {
  constructor(protected readonly ctx: RequestContext) {}

  /** Send a connection invitation. `POST /v1/invites` */
  send(body: SendInviteBody): Promise<SendInviteResult> {
    return this.ctx.request<SendInviteResult>({
      method: "POST",
      path: "/v1/invites",
      body,
    });
  }

  /** List sent invitations. `GET /v1/invites/sent` */
  listSent(params?: SentInviteListParams): Promise<SentInviteListPage> {
    return this.ctx.request<SentInviteListPage>({
      method: "GET",
      path: "/v1/invites/sent",
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /** List received invitations. `GET /v1/invites/received` */
  listReceived(params?: ReceivedInviteListParams): Promise<ReceivedInviteListPage> {
    return this.ctx.request<ReceivedInviteListPage>({
      method: "GET",
      path: "/v1/invites/received",
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /**
   * Accept or decline a received invitation.
   * `POST /v1/invites/received/{invitation_id}`
   */
  respond(invitationId: string, body: RespondInviteBody): Promise<RespondInviteResult> {
    return this.ctx.request<RespondInviteResult>({
      method: "POST",
      path: `/v1/invites/received/${invitationId}`,
      body,
    });
  }

  /** Cancel a sent invitation. `DELETE /v1/invites/{invitation_id}` */
  cancel(invitationId: string): Promise<CancelInviteResult> {
    return this.ctx.request<CancelInviteResult>({
      method: "DELETE",
      path: `/v1/invites/${invitationId}`,
    });
  }
}
