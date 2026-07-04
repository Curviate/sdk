/**
 * Accounts resource — account connection management.
 *
 * Pattern followed by all resource namespaces:
 *   - take a {@link RequestContext} in the constructor,
 *   - map each method to exactly one `/v1/*` operation,
 *   - type request/response from the generated OpenAPI types,
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

/** `POST /v1/accounts/link` request body. */
export type AccountLinkBody =
  paths["/v1/accounts/link"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/link` 201 response body. */
export type AccountLinkCreated =
  paths["/v1/accounts/link"]["post"]["responses"]["201"]["content"]["application/json"];

/** `POST /v1/accounts/link` 202 response body (checkpoint). */
export type AccountLinkCheckpoint =
  paths["/v1/accounts/link"]["post"]["responses"]["202"]["content"]["application/json"];

/** Union returned by `accounts.link()` — account or checkpoint. */
export type AccountLinkResult = AccountLinkCreated | AccountLinkCheckpoint;

/** `POST /v1/accounts/checkpoints/submit` request body. */
export type AccountSubmitCheckpointBody =
  paths["/v1/accounts/checkpoints/submit"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/checkpoints/submit` result — 201 (active) or 202 (chained challenge). */
export type AccountSubmitCheckpointResult =
  | paths["/v1/accounts/checkpoints/submit"]["post"]["responses"]["201"]["content"]["application/json"]
  | paths["/v1/accounts/checkpoints/submit"]["post"]["responses"]["202"]["content"]["application/json"];

/** `POST /v1/accounts/checkpoints/poll` request body. */
export type AccountPollCheckpointBody =
  paths["/v1/accounts/checkpoints/poll"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/checkpoints/poll` 200 body. */
export type AccountPollCheckpointResult =
  paths["/v1/accounts/checkpoints/poll"]["post"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/checkpoints/resend` request body. */
export type AccountResendCheckpointBody =
  paths["/v1/accounts/checkpoints/resend"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/checkpoints/resend` 200 body. */
export type AccountResendCheckpointResult =
  paths["/v1/accounts/checkpoints/resend"]["post"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/connect-link` request body. */
export type AccountConnectLinkBody =
  paths["/v1/accounts/connect-link"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/connect-link` 201 body. */
export type AccountConnectLinkResult =
  paths["/v1/accounts/connect-link"]["post"]["responses"]["201"]["content"]["application/json"];

/** `GET /v1/accounts/connect-sessions/{session_id}` 200 body. */
export type AccountConnectSessionResult =
  paths["/v1/accounts/connect-sessions/{session_id}"]["get"]["responses"]["200"]["content"]["application/json"];

/** `GET /v1/accounts/{account_id}` 200 body. */
export type AccountDetail =
  paths["/v1/accounts/{account_id}"]["get"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/reconnect` request body. */
export type AccountReconnectBody =
  paths["/v1/accounts/{account_id}/reconnect"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/reconnect` 200 body. */
export type AccountReconnectResult =
  paths["/v1/accounts/{account_id}/reconnect"]["post"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/refresh` 200 body. */
export type AccountRefreshResult =
  paths["/v1/accounts/{account_id}/refresh"]["post"]["responses"]["200"]["content"]["application/json"];

/** `PATCH /v1/accounts/{account_id}` request body. */
export type AccountUpdateBody =
  paths["/v1/accounts/{account_id}"]["patch"]["requestBody"]["content"]["application/json"];

/** `PATCH /v1/accounts/{account_id}` 200 body. */
export type AccountUpdateResult =
  paths["/v1/accounts/{account_id}"]["patch"]["responses"]["200"]["content"]["application/json"];

/** `DELETE /v1/accounts/{account_id}` 200 body. */
export type AccountDisconnectResult =
  paths["/v1/accounts/{account_id}"]["delete"]["responses"]["200"]["content"]["application/json"];

export class AccountsResource {
  constructor(private readonly ctx: RequestContext) {}

  /**
   * List the tenant's connected LinkedIn accounts, cursor-paginated.
   *
   * Each item also carries a small set of cached account-detail fields
   * (`username`, `premium_id`, `public_identifier`, `substrate_created_at`,
   * `signatures`, `groups`) populated by an async background enrichment —
   * `null`/`[]` until the account's first enrichment pass completes.
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

  /**
   * Connect a LinkedIn account to an empty seat.
   *
   * Returns an account (201) or a checkpoint challenge (202) when LinkedIn
   * requires verification. Callers discriminate on `result.object`.
   */
  link(body: AccountLinkBody): Promise<AccountLinkResult> {
    return this.ctx.request<AccountLinkResult>({
      method: "POST",
      path: "/v1/accounts/link",
      body,
    });
  }

  /**
   * Submit an OTP or 2FA code to resolve a checkpoint challenge.
   */
  submitCheckpoint(body: AccountSubmitCheckpointBody): Promise<AccountSubmitCheckpointResult> {
    return this.ctx.request<AccountSubmitCheckpointResult>({
      method: "POST",
      path: "/v1/accounts/checkpoints/submit",
      body,
    });
  }

  /**
   * Poll for mobile-app approval of a pending checkpoint challenge.
   */
  pollCheckpoint(body: AccountPollCheckpointBody): Promise<AccountPollCheckpointResult> {
    return this.ctx.request<AccountPollCheckpointResult>({
      method: "POST",
      path: "/v1/accounts/checkpoints/poll",
      body,
    });
  }

  /**
   * Re-send the pending verification challenge notification for an account.
   *
   * Useful when the end user says they never received the code or push
   * notification for a pending checkpoint. `resent` echoes the result
   * honestly: `true` once the notification was actually re-sent, `false`
   * when there was nothing to re-send for that challenge type (this call
   * never throws just because a resend wasn't applicable). Does not reset
   * the checkpoint's expiry.
   */
  resendCheckpoint(body: AccountResendCheckpointBody): Promise<AccountResendCheckpointResult> {
    return this.ctx.request<AccountResendCheckpointResult>({
      method: "POST",
      path: "/v1/accounts/checkpoints/resend",
      body,
    });
  }

  /**
   * Generate a one-time hosted connection link the end user opens to authorize a
   * LinkedIn connection without credentials transiting the API or LLM context.
   */
  createConnectLink(body: AccountConnectLinkBody): Promise<AccountConnectLinkResult> {
    return this.ctx.request<AccountConnectLinkResult>({
      method: "POST",
      path: "/v1/accounts/connect-link",
      body,
    });
  }

  /**
   * Poll a hosted connect session minted by {@link createConnectLink} (its
   * `session_id`).
   *
   * A pure status read — it makes no external call and does not itself complete
   * the connection. `status` is `pending` until the end user finishes the
   * hosted flow, then `resolved` (with `account_id`), or `expired` / `failed`.
   * Poll until it leaves `pending`.
   *
   * @param sessionId - the `session_id` returned on the connect-link 201 body.
   * @returns the session's current `status` and, once `resolved`, `account_id`.
   */
  getConnectSession(sessionId: string): Promise<AccountConnectSessionResult> {
    return this.ctx.request<AccountConnectSessionResult>({
      method: "GET",
      path: `/v1/accounts/connect-sessions/${sessionId}`,
    });
  }

  /**
   * Return metadata and current state for one connected account, including the
   * central `quotas[]` view for all tracked quota families and `seat_id` (the
   * seat this account occupies, `null` for an admin seatless account).
   *
   * This is a stale-while-revalidate read — it always returns immediately
   * from the cached row (never blocks on a live substrate call), and the
   * six cached enrichment fields (`username`, `premium_id`,
   * `public_identifier`, `substrate_created_at`, `signatures`, `groups`) are
   * `null`/`[]` until the account's first enrichment pass completes.
   */
  get(accountId: string): Promise<AccountDetail> {
    return this.ctx.request<AccountDetail>({
      method: "GET",
      path: `/v1/accounts/${accountId}`,
    });
  }

  /**
   * Re-authorize a disconnected account in place (same account_id, same seat).
   */
  reconnect(accountId: string, body: AccountReconnectBody): Promise<AccountReconnectResult> {
    return this.ctx.request<AccountReconnectResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/reconnect`,
      body,
    });
  }

  /**
   * Refresh frozen account sources (re-sync conversations, connection lists, etc.).
   */
  refresh(accountId: string): Promise<AccountRefreshResult> {
    return this.ctx.request<AccountRefreshResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/refresh`,
    });
  }

  /**
   * Update managed-proxy configuration for an account.
   */
  update(accountId: string, body: AccountUpdateBody): Promise<AccountUpdateResult> {
    return this.ctx.request<AccountUpdateResult>({
      method: "PATCH",
      path: `/v1/accounts/${accountId}`,
      body,
    });
  }

  /**
   * Hard-disconnect a LinkedIn account; releases the attached seat.
   */
  disconnect(accountId: string): Promise<AccountDisconnectResult> {
    return this.ctx.request<AccountDisconnectResult>({
      method: "DELETE",
      path: `/v1/accounts/${accountId}`,
    });
  }
}
