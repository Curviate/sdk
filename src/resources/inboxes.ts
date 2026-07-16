/**
 * Inboxes resource — 2 methods (NEW namespace, BETA).
 *
 * Account-scoped: the bound context injects `account_id` as the leading
 * `/v1/` path segment on every request (account-first grammar) — never a
 * query param or body field.
 *
 * Discovers the account's personal inbox plus, when the company product is
 * attached, one entry per company page × folder, and lists a single inbox's
 * conversations. Every returned chat id is send-ready: pass it directly to
 * `messaging.sendMessage()` to reply — a company inbox's chat id (e.g.
 * `COMPANY_83734124_2-…`) replies AS THE PAGE, no separate parameter needed,
 * and the send response echoes `sent_as` confirming the acting identity.
 * Company inboxes are reply-only (`reply_only: true`) — they cannot start a
 * new conversation; use `messaging.startChat()` for personal (`CLASSIC_`)
 * inboxes only.
 *
 * **Beta:** this namespace is new — single-page listing is verified; deep
 * pagination against a busier inbox is still being validated.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type InboxListPage =
  paths["/v1/{account_id}/inboxes"]["get"]["responses"]["200"]["content"]["application/json"];
export type InboxListQuery = NonNullable<
  paths["/v1/{account_id}/inboxes"]["get"]["parameters"]["query"]
>;

export type InboxChatListPage =
  paths["/v1/{account_id}/inboxes/{inbox_id}/chats"]["get"]["responses"]["200"]["content"]["application/json"];
export type InboxChatListQuery = NonNullable<
  paths["/v1/{account_id}/inboxes/{inbox_id}/chats"]["get"]["parameters"]["query"]
>;

// ─── Resource class ───────────────────────────────────────────────────────────

export class InboxesResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * List the account's inboxes — its personal inbox plus, when the company
   * product is attached, one entry per company page × folder (id like
   * `"COMPANY_83734124_PRIMARY"`). `GET /v1/{account_id}/inboxes`
   *
   * Company inboxes carry `reply_only: true` — reply to an existing
   * conversation via `messaging.sendMessage()`, never `startChat()`.
   * `company_id` is resolved by correlating the page name against the
   * account's managed pages; an uncorrelatable page reports
   * `company_id: null`, never a fabricated id. When no company inbox
   * exists, `hint` names the Company Pages reconnect requirement instead of
   * an empty list.
   *
   * **Beta.**
   *
   * @param params - optional `{ kind }` (`"personal"` or `"company"`)
   *   and/or `{ company_id }` filters. Omit to list every inbox.
   *
   * @example
   * const { items, hint } = await acc.inboxes.list({ kind: "company" });
   * console.log(items[0]?.id, hint);
   */
  list(params?: InboxListQuery): Promise<InboxListPage> {
    return this.ctx.request<InboxListPage>({
      method: "GET",
      path: `/v1/{account_id}/inboxes`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }

  /**
   * List an inbox's conversations, newest-activity-first, cursor-paginated.
   * `GET /v1/{account_id}/inboxes/{inbox_id}/chats`
   *
   * Every chat's `id` is send-ready — pass it directly to
   * `messaging.sendMessage(chatId, { text })` to reply. A company inbox's
   * chat id (e.g. `"COMPANY_83734124_2-YTQ3ODU3Njgt"`) replies AS THE PAGE,
   * no separate parameter needed:
   *
   * ```ts
   * const { items } = await acc.inboxes.listChats("COMPANY_83734124_PRIMARY");
   * const chatId = items[0]!.id as string; // e.g. "COMPANY_83734124_2-YTQ3ODU3Njgt"
   * await acc.messaging.sendMessage(chatId, { text: "Thanks for reaching out!" });
   * ```
   *
   * Works identically for personal (`CLASSIC_`) inboxes. An unknown
   * `inbox_id` returns `RESOURCE_NOT_FOUND` (404). **Beta.**
   *
   * @param inboxId - the inbox id from `list()` (e.g. `"CLASSIC_PRIMARY"`
   *   or `"COMPANY_83734124_PRIMARY"`).
   * @param params - optional `limit` (1–25, default 20) and an opaque
   *   `cursor` for pagination.
   */
  listChats(inboxId: string, params?: InboxChatListQuery): Promise<InboxChatListPage> {
    return this.ctx.request<InboxChatListPage>({
      method: "GET",
      path: `/v1/{account_id}/inboxes/${inboxId}/chats`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }
}
