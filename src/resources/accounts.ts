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

/** `POST /v1/accounts/{account_id}/checkpoint/solve` request body. */
export type AccountSolveCheckpointBody =
  paths["/v1/accounts/{account_id}/checkpoint/solve"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/checkpoint/solve` result — 201 (active) or 202 (chained challenge). */
export type AccountSolveCheckpointResult =
  | paths["/v1/accounts/{account_id}/checkpoint/solve"]["post"]["responses"]["201"]["content"]["application/json"]
  | paths["/v1/accounts/{account_id}/checkpoint/solve"]["post"]["responses"]["202"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/checkpoint/request` 200 body. */
export type AccountRequestCheckpointResult =
  paths["/v1/accounts/{account_id}/checkpoint/request"]["post"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/checkpoint/poll` 200 body. */
export type AccountPollCheckpointResult =
  paths["/v1/accounts/{account_id}/checkpoint/poll"]["post"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/connect-link` request body. */
export type AccountConnectLinkBody =
  paths["/v1/accounts/connect-link"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/connect-link` 201 body. */
export type AccountConnectLinkResult =
  paths["/v1/accounts/connect-link"]["post"]["responses"]["201"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/reconnect-link` request body. */
export type AccountReconnectLinkBody =
  paths["/v1/accounts/{account_id}/reconnect-link"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/reconnect-link` 201 body. */
export type AccountReconnectLinkResult =
  paths["/v1/accounts/{account_id}/reconnect-link"]["post"]["responses"]["201"]["content"]["application/json"];

/** `GET /v1/accounts/connect-sessions/{session_id}` 200 body. */
export type AccountConnectSessionResult =
  paths["/v1/accounts/connect-sessions/{session_id}"]["get"]["responses"]["200"]["content"]["application/json"];

/** `GET /v1/accounts/{account_id}` 200 body. */
export type AccountDetail =
  paths["/v1/accounts/{account_id}"]["get"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/reconnect` request body. */
export type AccountReconnectBody =
  paths["/v1/accounts/{account_id}/reconnect"]["post"]["requestBody"]["content"]["application/json"];

/** `POST /v1/accounts/{account_id}/reconnect` result — 200 (active) or 202 (checkpoint). */
export type AccountReconnectResult =
  | paths["/v1/accounts/{account_id}/reconnect"]["post"]["responses"]["200"]["content"]["application/json"]
  | paths["/v1/accounts/{account_id}/reconnect"]["post"]["responses"]["202"]["content"]["application/json"];

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
   * requires verification. Callers discriminate on `result.object`; resolve a
   * 202 with {@link solveCheckpoint} (code) or {@link pollCheckpoint}
   * (mobile-app approval).
   *
   * For `auth_method: "cookie"`, `user_agent` is **required** — connecting by
   * session cookie without one is rejected with `INVALID_REQUEST`. It stays
   * optional for `auth_method: "credentials"`.
   *
   * On a 201 account, `recovered` is `true` only when the connect reclaimed a
   * LinkedIn identity already present on the workspace (claiming it into your
   * account) rather than connecting a brand-new one — it is absent on a normal
   * connect. Its `status` reflects the account's real observed state: as well as
   * `active` it may be `reconnect_needed`, `restricted`, or `disconnected` (a
   * recovered identity often needs a reconnect).
   */
  link(body: AccountLinkBody): Promise<AccountLinkResult> {
    return this.ctx.request<AccountLinkResult>({
      method: "POST",
      path: "/v1/accounts/link",
      body,
    });
  }

  /**
   * Solve a checkpoint challenge by submitting an OTP or 2FA code.
   *
   * The account is addressed by `accountId` (the provisional `account_id`
   * returned on the 202 `checkpoint_required` response); the body carries the
   * `code`. Returns the connected account (201) or, when LinkedIn chains a
   * second challenge, another checkpoint (202) — resolve that one with a
   * further `solveCheckpoint` call for the same `accountId`.
   *
   * On the 201 account, `recovered` is `true` only when solving the challenge
   * reclaimed a LinkedIn identity already present on the workspace (rather than
   * connecting a brand-new one); it is absent otherwise. Its `status` reflects
   * the account's real observed state — as well as `active` it may be
   * `reconnect_needed`, `restricted`, or `disconnected`.
   *
   * @param accountId - the provisional `account_id` from the 202 response.
   * @param body - the verification `code`.
   */
  solveCheckpoint(accountId: string, body: AccountSolveCheckpointBody): Promise<AccountSolveCheckpointResult> {
    return this.ctx.request<AccountSolveCheckpointResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/checkpoint/solve`,
      body,
    });
  }

  /**
   * Re-request the pending verification challenge notification for an account.
   *
   * Useful when the end user says they never received the code or push
   * notification for a pending checkpoint. `resent` echoes the outcome
   * honestly: `true` once the notification was actually re-sent, `false` when
   * there was nothing to re-send for that challenge type (this call never
   * throws just because a re-send wasn't applicable). Does not reset the
   * checkpoint's expiry.
   *
   * @param accountId - the provisional `account_id` from the 202 response.
   */
  requestCheckpoint(accountId: string): Promise<AccountRequestCheckpointResult> {
    return this.ctx.request<AccountRequestCheckpointResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/checkpoint/request`,
    });
  }

  /**
   * Poll for mobile-app approval of a pending checkpoint challenge.
   *
   * The account is addressed by `accountId` (the provisional `account_id`
   * from the 202 response). `status` is `pending` until the end user approves
   * on their device, then `active` (the account is connected), or
   * `expired` / `failed`. Poll until it leaves `pending`.
   *
   * On `status: "expired"` (the approval timed out), the response carries
   * `challenge_type` (`"mobile_app_approval"`) and a human-readable
   * `recovery_hint` — the actionable next step — so a client can render the
   * right recovery guidance without parsing prose.
   *
   * @param accountId - the provisional `account_id` from the 202 response.
   */
  pollCheckpoint(accountId: string): Promise<AccountPollCheckpointResult> {
    return this.ctx.request<AccountPollCheckpointResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/checkpoint/poll`,
    });
  }

  /**
   * Generate a one-time hosted connection link the end user opens to authorize
   * a new LinkedIn connection without credentials transiting the API or LLM
   * context. Poll completion with {@link getConnectSession} using the returned
   * `session_id`. To re-authorize an existing account, use
   * {@link createReconnectLink} instead.
   */
  createConnectLink(body: AccountConnectLinkBody): Promise<AccountConnectLinkResult> {
    return this.ctx.request<AccountConnectLinkResult>({
      method: "POST",
      path: "/v1/accounts/connect-link",
      body,
    });
  }

  /**
   * Generate a one-time hosted **re-authorization** link for an existing
   * account that became disconnected — the hosted counterpart of
   * {@link reconnect}. The end user opens the returned `url`; poll completion
   * with {@link getConnectSession} using the returned `session_id`. The account
   * keeps its `account_id` and seat.
   *
   * @param accountId - the account to re-authorize.
   * @param body - optional `expires_in_seconds` and `redirect_url`.
   */
  createReconnectLink(accountId: string, body?: AccountReconnectLinkBody): Promise<AccountReconnectLinkResult> {
    return this.ctx.request<AccountReconnectLinkResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/reconnect-link`,
      ...(body !== undefined ? { body } : {}),
    });
  }

  /**
   * Poll a hosted connect session minted by {@link createConnectLink} or
   * {@link createReconnectLink} (its `session_id`).
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
   * from the cached row (never blocks on a live substrate call). The cached
   * enrichment fields `full_name` and `substrate_created_at` are populated by
   * a background enrichment pass; `username`, `premium_id`,
   * `public_identifier`, `signatures`, and `groups` are not sourced on the
   * current connection surface and read `null`/`[]`.
   */
  get(accountId: string): Promise<AccountDetail> {
    return this.ctx.request<AccountDetail>({
      method: "GET",
      path: `/v1/accounts/${accountId}`,
    });
  }

  /**
   * Re-authorize a disconnected account in place (same `account_id`, same
   * seat). Returns the reconnected account (200) or a checkpoint challenge
   * (202) when LinkedIn requires verification — resolve a 202 with
   * {@link solveCheckpoint} / {@link pollCheckpoint}, exactly like {@link link}.
   *
   * For `auth_method: "cookie"`, `user_agent` is **required** (as on
   * {@link link}). For the hosted re-auth flow, use {@link createReconnectLink}.
   */
  reconnect(accountId: string, body: AccountReconnectBody): Promise<AccountReconnectResult> {
    return this.ctx.request<AccountReconnectResult>({
      method: "POST",
      path: `/v1/accounts/${accountId}/reconnect`,
      body,
    });
  }

  /**
   * Update an account's configuration.
   *
   * `metadata` is a flat string→string map that **replaces** the account's
   * custom-data store wholesale (keys not provided are removed). `proxy` sets a
   * custom egress proxy, or clears it (reverting to automatic proxy protection)
   * when passed as `null`. The `proxy.password`, if given, is stored securely
   * and never returned.
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
