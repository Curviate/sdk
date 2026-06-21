/**
 * Webhooks resource — 6 methods (sdk/002 FR-002; root-scoped).
 *
 * Root-scoped: webhooks are tenant-wide, not account-scoped. All methods are
 * mounted directly on the root client (like `accounts`).
 * getStateDiff is placed here because it is tagged Webhooks in the OpenAPI
 * (GET /v1/accounts/:id/state-diff enables event-driven state sync).
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type WebhookCreateBody =
  paths["/v1/webhooks"]["post"]["requestBody"]["content"]["application/json"];
export type WebhookCreateResult =
  paths["/v1/webhooks"]["post"]["responses"]["201"]["content"]["application/json"];

export type WebhookListParams = NonNullable<
  paths["/v1/webhooks"]["get"]["parameters"]["query"]
>;
export type WebhookListResult =
  paths["/v1/webhooks"]["get"]["responses"]["200"]["content"]["application/json"];

export type WebhookListEventsResult =
  paths["/v1/webhooks/events"]["get"]["responses"]["200"]["content"]["application/json"];

export type WebhookUpdateBody =
  paths["/v1/webhooks/{id}"]["patch"]["requestBody"]["content"]["application/json"];
export type WebhookUpdateResult =
  paths["/v1/webhooks/{id}"]["patch"]["responses"]["200"]["content"]["application/json"];

export type WebhookDeleteResult =
  paths["/v1/webhooks/{id}"]["delete"]["responses"]["200"]["content"]["application/json"];

export type AccountStateDiffParams = NonNullable<
  paths["/v1/accounts/{id}/state-diff"]["get"]["parameters"]["query"]
>;
export type AccountStateDiffResult =
  paths["/v1/accounts/{id}/state-diff"]["get"]["responses"]["200"]["content"]["application/json"];

// ─── Resource class ───────────────────────────────────────────────────────────

export class WebhooksResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Register a new webhook endpoint to receive real-time events.
   * `POST /v1/webhooks`
   * The HMAC signing secret is returned exactly once in the 201 response.
   * `account_ids` is required for security (api/011).
   */
  create(body: WebhookCreateBody): Promise<WebhookCreateResult> {
    return this.ctx.request<WebhookCreateResult>({
      method: "POST",
      path: "/v1/webhooks",
      body,
    });
  }

  /**
   * List the tenant's registered webhooks, cursor-paginated.
   * `GET /v1/webhooks`
   */
  list(params?: WebhookListParams): Promise<WebhookListResult> {
    return this.ctx.request<WebhookListResult>({
      method: "GET",
      path: "/v1/webhooks",
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Return the complete canonical webhook event catalogue (21 events, grouped by source).
   * `GET /v1/webhooks/events`
   */
  listEvents(): Promise<WebhookListEventsResult> {
    return this.ctx.request<WebhookListEventsResult>({
      method: "GET",
      path: "/v1/webhooks/events",
    });
  }

  /**
   * Update a webhook in place. `source` is immutable.
   * `PATCH /v1/webhooks/{id}`
   */
  update(id: string, body: WebhookUpdateBody): Promise<WebhookUpdateResult> {
    return this.ctx.request<WebhookUpdateResult>({
      method: "PATCH",
      path: `/v1/webhooks/${id}`,
      body,
    });
  }

  /**
   * Permanently remove a webhook subscription.
   * `DELETE /v1/webhooks/{id}`
   */
  delete(id: string): Promise<WebhookDeleteResult> {
    return this.ctx.request<WebhookDeleteResult>({
      method: "DELETE",
      path: `/v1/webhooks/${id}`,
    });
  }

  /**
   * Return the set of changes since the last known version for a connected account.
   * Enables event-driven state sync without polling the account endpoint.
   * `GET /v1/accounts/{id}/state-diff`
   * Tagged Webhooks in the OpenAPI (sdk/002 FR-002).
   */
  getStateDiff(accountId: string, params?: AccountStateDiffParams): Promise<AccountStateDiffResult> {
    return this.ctx.request<AccountStateDiffResult>({
      method: "GET",
      path: `/v1/accounts/${accountId}/state-diff`,
      ...(params ? { query: params } : {}),
    });
  }
}
