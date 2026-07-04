# Changelog

All notable changes to `@curviate/sdk` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: semantic — minor for additive changes, patch for bug fixes; no stability promise before 1.0.

---

## [Unreleased]

### Added

- **New `companies` namespace (5 methods).** `companies.get(identifier)` retrieves a company's full LinkedIn profile — accepts either a public handle (the slug in `linkedin.com/company/<handle>`, e.g. `"t-systems"`) or a numeric id. `companies.employees(identifier, params?)`, `companies.posts(identifier, params?)`, and `companies.jobs(identifier, params?)` list company sub-resources (filterable with `keywords`/`location` where supported); `companies.followers(identifier, params?)` lists company followers (requires the acting account to administer the target page). The four sub-resource methods require the company's **numeric provider_id** (the same `id` field `companies.get()` returns) — a handle or URN is rejected server-side before any upstream call. Types: `CompanyProfile`, `CompanyEmployeeListPage`, `CompanyPostListPage`, `CompanyJobListPage`, `CompanyFollowerListPage`.
- **New `ErrorCode` value: `RESOURCE_ACCESS_RESTRICTED`.** The non-admin mapping for `companies.followers()` — surfaced when the acting account does not administer the target company page. Added to the `ErrorCode` union and the transport's known-code set (previously unknown codes silently narrowed to `INTERNAL`).

### Removed (BREAKING)

- **`profiles.getCompany(companyId)` removed** — hard-moved to `companies.get(identifier)`. The underlying endpoint (`GET /v1/profiles/companies/{company_id}`) no longer exists; there is no alias. Update call sites to `companies.get()`.

## [0.11.0] — 2026-07-04

### Added

- **`accounts.getConnectSession(session_id)`.** Poll a hosted connect session minted by `accounts.createConnectLink()`. A pure status read — it makes no external call and does not itself complete the connection (the connection is signalled complete out-of-band once the end user finishes the hosted flow). Returns `{ object: "connect_session", session_id, status, account_id, expires_at }`, where `status` is `"pending" | "resolved" | "expired" | "failed"` and `account_id` is populated only once `status` is `"resolved"`. Poll until it leaves `pending`. Type: `AccountConnectSessionResult`. Extends the Accounts surface to 12 methods.
- **`accounts.resendCheckpoint({ account_id })`.** Re-sends the pending verification challenge notification for an account (e.g. when the end user says they never received the OTP/2FA code or the mobile-app push). Returns `{ object: "checkpoint", account_id, resent }` — `resent` echoes the outcome honestly (`false` when there was nothing to re-send for that challenge type; this never throws just because a resend wasn't applicable). Does not reset the checkpoint's expiry.
- **`session_id` on the `accounts.createConnectLink()` 201 response** — the durable poll handle to pass to `accounts.getConnectSession()`. Type: `AccountConnectLinkResult`.
- **`seat_id` on the account-connection responses.** `accounts.link()` (201), `accounts.submitCheckpoint()` (201), and `accounts.pollCheckpoint()` now carry `seat_id` (`string | null`) — the seat the account occupies. `accounts.createConnectLink()` (201) also carries it. This is the canonical replacement for the deprecated `attached_seat_id` (same value).
- **`auth_method: "hosted"`** is now a possible value on `accounts.list()` items (accounts connected through a hosted link). Response-only — the `link()` / `reconnect()` request `auth_method` remains `"credentials" | "cookie"`.
- **`"disconnected"` account status.** Now a possible `status` on `accounts.list()` items, `accounts.get()`, and both sides of the account `state-diff` event — whose `previous_status` / `current_status` are now typed enums (`"active" | "reconnect_needed" | "restricted" | "connecting" | "disconnected"`) rather than free-form strings.

### Deprecated

- **`attached_seat_id`** (on `accounts.link()`, `accounts.submitCheckpoint()`, and `accounts.pollCheckpoint()` responses) — use `seat_id` instead (identical value). Retained for backward compatibility; slated for removal at the GA `/v1` cutover.

### Changed

- Regenerated types from the current API surface (full refresh). Beyond the additions above, `accounts.update()` (`PATCH /v1/accounts/{account_id}`) gains a `501` response variant, returned when a managed-proxy configuration isn't supported for the account's current plan (not retryable as-is — change the request rather than resubmitting). No resource method signatures changed.

## [0.10.0] — 2026-07-03

### Added

- **New `jobs` namespace.** `jobs.get(jobIdOrUrl)` retrieves one public LinkedIn job posting's full detail — title, company, location, description, applicant count, and more. Accepts either a bare numeric job id (e.g. `"4428113858"`) or a full job URL (`"https://www.linkedin.com/jobs/view/4428113858"`) — the SDK extracts the numeric id client-side, so both forms issue the identical request. Passing a value with no extractable numeric id throws `CurviateError({ code: "INVALID_REQUEST" })` synchronously, before any network call. Type: `JobPosting`.
- `recruiter.getJob(jobIdOrUrl)` — the Recruiter-lens sibling, retrieving any public job posting (not only the operator's own postings). Accepts the same bare-id-or-URL forms as `jobs.get()` and returns the identical `JobPosting` type (no separate response shape to learn). Extends the Recruiter surface to 18 methods.

## [0.9.0] — 2026-07-03

### Added

- **Account enrichment fields.** `accounts.list()` items and `accounts.get()` now carry six cached account-detail fields, populated by an async background enrichment on every successful account activation: `username`, `premium_id`, `public_identifier`, `substrate_created_at` (ISO-8601 UTC), `signatures` (`{title, content}[]`), and `groups` (`string[]`). All six are `null`/`[]` until the account's first enrichment pass completes — never `undefined`, never a missing key. Types: `AccountListPage`, `AccountDetail`.
- `accounts.get()` gains `seat_id` (`string | null`) — the seat the account occupies, `null` for an admin seatless account. Previously only `accounts.list()` items carried this field.

### Changed

- `connected_at` (on both `accounts.list()` items and `accounts.get()`) and `last_checked_at` (`accounts.get()`) now consistently emit ISO-8601 UTC (`…Z`) timestamps — a prior docs-vs-runtime drift meant these could reach callers in raw Postgres wire format. No type change (already typed as `string`/`string | null`); this is a runtime-correctness fix reflected in the regenerated example values.
- Regenerated types from the current API surface. No resource method signatures changed — purely additive response fields.
- `quotas[]` (on `accounts.get()`) is now documented as advisory usage-safety recommendations: daily families never cause a rejected request; only `account.per_minute` is a binding limit enforced with HTTP 429. `recommended_throttle_hint` semantics documented per level (`none` / `slow_down` / `backoff` are advisory; `stop` is reserved for the binding per-minute limit). JSDoc-only — no type shape change.

---

## [0.8.0] — 2026-07-02

### Added

- **Recruiter job-lifecycle endpoints are now fully implemented server-side.** The following operations no longer return `501` and are safe to call in production: getting/rejecting an applicant, downloading an applicant's resume, listing a job's applicants, solving a job's publish checkpoint, publishing a job, and fetching a Recruiter profile. Their generated response types no longer include a `501` variant — if your code branched on it, that branch is now dead and can be removed.
- Richer parameter documentation across the Recruiter and search surfaces: job/applicant/hiring-project IDs now describe where to obtain them (e.g. `job_id` from `GET /v1/recruiter/jobs`, `user_id` from a people-search result), and several previously-terse descriptions were corrected (e.g. the saved-search `industry` filter's cross-reference).
- Server-side parameter defaults are now surfaced in the generated JSDoc (`@default`) wherever the API applies one when a param is omitted — link-expiry seconds, chat visibility, hiring-project list `limit`, webhook delivery `format`/`enabled`/`headers`/`data`, and more.
- **Breaking (typed consumers):** the Sales Navigator company-search `annual_revenue.min`/`max` filter is now a bucketed numeric enum (`0 | 0.2 | 1 | 2.5 | 5 | 10 | 20 | 50 | 100 | 500 | 1000 | 1001`) instead of a free-form `number`, matching what the API actually accepts. Code passing arbitrary numbers no longer typechecks — pick the nearest bucket value. Runtime behavior is unchanged (the API already only accepted these buckets).

### Changed

- **Search filter guard-rails are now documented.** `search.companies` `limit` requires a minimum of 2 (was 1) — the API rejects single-result company searches. `search.jobs` `benefits` and `commitments` filters now document their accepted values. `search.people` `open_to` now documents its accepted values (`proBono`, `boardMember`). The `search.posts` request examples were corrected to use the actual `member`/`company` array filter shape instead of a `member_urn` string.
- Regenerated types from the current API surface. No resource method signatures changed.

---

## [0.7.0] — 2026-07-01

### Changed

- **Breaking (typed consumers):** `recruiter.startChat` 201 response — the `attendee_ids` field is removed and replaced by `message_id` (the opening message identifier). Final shape: `{ object: "chat_started", chat_id, message_id }`, matching `messaging.startChat` and `salesNavigator.startChat`. `chat_id` is now non-nullable on a 201. Type: `RecruiterStartChatResult`. Migration: read `res.message_id`.
  - *Why:* product-API + core / Sales Navigator parity — the underlying LinkedIn start-chat operation returns an identical `{ object, chat_id, message_id }` for every product; the prior `attendee_ids` echo had no product-API basis.
- The `recruiter.startChat` request body is unchanged (`attendees_ids` plus all recruiter-specific params).
- Regenerated types from the updated API surface.

---

## [0.6.0] — 2026-07-01

### Added

- **Recruiter start-chat response gains `object: "chat_started"` discriminator.** The 201 response from `recruiter.startChat` now includes `object: "chat_started"` as a required field. Type: `RecruiterStartChatResult`.

### Changed

- **Breaking (typed consumers):** `salesNavigator.syncMessages` and `recruiter.syncMessages` — the 200 response field `sync_status` is renamed to `status`. Enum values (`sync_started | running | done | error`) are unchanged. Types: `SNSyncMessagesResult`, `RecruiterSyncMessagesResult`.
- **Breaking (typed consumers):** `recruiter.startChat` request body field `attendee_ids` → `attendees_ids`. The **response** `attendee_ids` field is unchanged. Type: `RecruiterStartChatBody`.
- Recruiter start-chat 201 response no longer surfaces a separate `quota` field — remaining InMail capacity is read from `GET /v1/accounts/{account_id}`.
- Regenerated types from the updated API surface (SN/Recruiter messaging parity).

---

## [0.5.0] — 2026-07-01

### Added

- Posts search gains nested `posted_by`, `mentioning`, and `author` filter objects. `posted_by` and `mentioning` take `member` / `company` arrays of opaque IDs (from `GET /v1/search/parameters`); `posted_by` also accepts `me`, `first_connections`, and `people_you_follow` booleans; `author` filters by `industry`, `company`, or `keywords`.
- Search-parameters items (`GET /v1/search/parameters`) now carry nullable company-disambiguation fields — `industry`, `location`, `headcount` (human-readable size range), and `followers_count` — populated only for `type=COMPANY` results.

### Changed

- **Breaking (typed consumers):** people-search `connections_of` and `followers_of` are now arrays of opaque member IDs (`string[]`) instead of a single `string`. Pass one or more IDs resolved from `GET /v1/search/parameters`.
- **Breaking (typed consumers):** posts-search replaces the flat `member_urn` / `company_urn` filters with the nested `posted_by` / `mentioning` / `author` objects described above.
- **Breaking (typed consumers):** jobs-search `location_within_area` is now a `number` (search radius in miles) instead of a `string`.
- Company-size (`headcount`) bucket bounds are documented with their explicit valid values.
- De-branded the four search method summaries in the SDK JSDoc (`Search people/companies/posts/jobs`).
- Regenerated types from the current API surface.

---

## [0.4.2] — 2026-07-01

### Added

- Invitation item `specifics` now includes `provider: "LINKEDIN"` on both `InvitationSent` and `InvitationReceived` — the platform the invitation belongs to, passed through alongside `shared_secret`.

### Changed

- Removed the `422` response from `invites.cancel` (`DELETE /v1/invites/{invitation_id}`) and `invites.respond` (`POST /v1/invites/received/{invitation_id}`): cancel is idempotent (`canceled`/`not_found` only) and a non-pending handle returns `not_found`, so neither surfaces an account-restricted `422`.
- Regenerated types from the current API surface, consolidating the invitation-item changes on top of the 0.4.1 people-search and 0.4.0 profile/messaging types.

---

## [0.4.1] — 2026-06-30

### Added

- `people_search_result` item now includes `id: string` — the raw LinkedIn provider id for the person (e.g. `ACoAA…` format). This is the first property on the item type.

---

## [0.4.0] — 2026-06-30

### Added

- `primary_locale` (`{ country, language } | null`) on the `Profile` and `OwnProfile` types — a profile's primary locale as set by LinkedIn (`language` is a BCP 47 tag, `country` an ISO 3166-1 alpha-2 code). Present on `GET /v1/profiles/{id}`; on `/me` it is populated when `linkedin_sections` is supplied.

### Changed

- The account re-sync response (`GET /v1/messages/sync`) field is now `status` (was `sync_status`), aligning with the chat-history sync response. Sales Navigator and Recruiter re-sync responses are unchanged (`sync_status`).
- Regenerated types from the current API: refreshed endpoint and error descriptions to neutral wording. No request shapes changed.

---

## [0.3.0] — 2026-06-29

### Added

- `sendInMail` now accepts `surface: "classic"` for sending InMail from an account's own premium InMail credits (in addition to `"sales_nav"` and `"recruiter"`). The `recipient_urn` field accepts either a member URN (`urn:li:member:<id>`) or a member provider id (`ACo…`).

### Changed

- Regenerated types from the current API: refreshed several endpoint descriptions (message delete, post id forms, reaction list) to match the live reference. No request/response shapes changed beyond the `surface` addition above.

---

## [0.2.1] — 2026-06-29

### Fixed

- `deleteMessage` and `addReaction` no longer inject `account_id` into the request. The server resolves the owning account from the message id — sending a client-supplied `account_id` was rejected by the server's strict schema, making both methods unusable via `client.account(id)`. The server's schemas are also relaxed (patch on the server side) so existing SDK installs continue to work without updating.

---

## [0.2.0] — 2026-06-28

### Added

- `profiles.getMe(params?)` now accepts an optional `linkedin_sections` array to request specific LinkedIn profile sections (e.g. education, experience, skills); responses include only the requested enrichment fields.
- `OwnProfile` type is normalized: `is_premium` and `is_open_profile` are always present on the response. Enriched section fields (`headline`, `summary`, `work_experience`, `education`, `skills`, and more) are present when the corresponding section was requested.
- `Chat` type now includes a `subject` field (nullable string) reflecting the conversation subject where available.

### Changed

- Array-valued query parameters are now serialized as repeated keys (`?key=a&key=b`) rather than as a comma-joined string. This matches the server's expected format for array parameters such as `linkedin_sections`.

---

## [0.1.1] — 2026-06-22

### Fixed

- Account-scoped write requests now send the account identifier in the request body where the API expects it. Previously the account identifier was always sent as a query parameter, regardless of the operation, which caused account-scoped write requests (sending invitations and InMail, posting and commenting, reacting, endorsing, saving leads, and the Recruiter pipeline writes) to be rejected. Read requests, body-less deletes, and filter-search requests are unaffected — they continue to carry the account identifier as a query parameter, matching the API. An account identifier you pass explicitly in a request still takes precedence and is never overwritten.

---

## [0.1.0] — 2026-06-21

Initial public release.

### Added

**Client and auth**
- `new Curviate({ apiKey })` — configures the SDK with a Bearer API key, base URL (`https://api.curviate.com`), timeout, and max retries.
- `curviate.account(accountId)` — returns an account-scoped accessor; all LinkedIn operations are tied to a managed account.

**Resource surface**

- `curviate.accounts.*`:
  - `list(params?)` — list managed accounts with optional `limit` and `cursor`.
  - `get(accountId)` — fetch a single managed account.
  - `link(body)` — connect a LinkedIn account via cookie or API key; returns an account or a checkpoint.
  - `reconnect(accountId, body)` — reconnect a disconnected account.
  - `refresh(accountId)` — force a session refresh.
  - `update(accountId, body)` — update account settings.
  - `disconnect(accountId)` — disconnect a managed account.
  - `submitCheckpoint(body)` — submit a 2FA / CAPTCHA checkpoint challenge.
  - `pollCheckpoint(body)` — poll for checkpoint resolution.
  - `createConnectLink(body)` — generate a hosted connect link.

- `curviate.account(id).messaging.*`:
  - `listChats(params?)` — list conversation threads.
  - `getChat(chatId)` — fetch a single chat.
  - `startChat(body)` — start a new conversation.
  - `listMessages(chatId, params?)` — list messages in a chat.
  - `getMessage(messageId)` — fetch a single message.
  - `sendMessage(chatId, body)` — send a message into a chat.
  - `editMessage(messageId, body)` — edit a sent message.
  - `deleteMessage(messageId)` — delete a sent message.
  - `addReaction(messageId, body)` — add an emoji reaction.
  - `getAttachment(messageId, attachmentId)` — download a message attachment.
  - `syncChat(chatId)` — trigger a chat history sync.
  - `syncMessages(params?)` — trigger a full message sync.
  - `sendInMail(body)` — send an InMail.
  - `getInMailBalance(params?)` — fetch InMail credit balance.

- `curviate.account(id).profiles.*`:
  - `get(profileId, params?)` — fetch a LinkedIn profile by id or handle.
  - `getMe()` — fetch the profile for the managed account holder.
  - `getCompany(companyId)` — fetch a company profile.
  - `listConnections(params?)` — list the account's connections.
  - `listFollowers(profileId, params?)` — list a profile's followers.
  - `listPosts(profileId, params?)` — list a profile's posts.
  - `listComments(profileId, params?)` — list a profile's post comments.
  - `listReactions(profileId, params?)` — list a profile's post reactions.
  - `endorse(profileId, body)` — endorse skills on a profile.

- `curviate.account(id).invites.*`:
  - `send(body)` — send a connection invitation.
  - `listSent(params?)` — list sent invitations.
  - `listReceived(params?)` — list received invitations.
  - `respond(invitationId, body)` — accept or ignore a received invitation.
  - `cancel(invitationId)` — cancel a sent invitation.

- `curviate.account(id).posts.*`:
  - `list(params?)` — list posts visible to the account.
  - `get(postId)` — fetch a single post.
  - `create(body)` — create a post.
  - `listComments(postId, params?)` — list comments on a post.
  - `comment(postId, body)` — comment on a post.
  - `listReactions(postId, params?)` — list reactions on a post.
  - `react(postId, body)` — react to a post.

- `curviate.account(id).salesNavigator.*`:
  - `searchPeople(body, params?)` — search people via Sales Navigator.
  - `searchCompanies(body, params?)` — search companies via Sales Navigator.
  - `getProfile(identifier, params?)` — fetch a Sales Navigator profile.
  - `getParameters(params)` — fetch available search filter parameters.
  - `saveLead(userId, body)` — save a lead.
  - `startChat(body)` — start a Sales Navigator conversation.
  - `syncMessages(params)` — sync Sales Navigator messages.

- `curviate.account(id).recruiter.*`:
  - `searchPeople(body, params?)` — search candidates via LinkedIn Recruiter.
  - `getProfile(identifier, params?)` — fetch a Recruiter candidate profile.
  - `getParameters(params)` — fetch available search filter parameters.
  - `syncMessages(params)` — sync Recruiter messages.
  - `startChat(body)` — start a Recruiter conversation.
  - `listProjects(params?)` — list Recruiter projects.
  - `getProject(projectId)` — fetch a single Recruiter project.
  - `addCandidate(userId, body)` — add a candidate to a project.
  - `addApplicant(userId, body)` — add an applicant to a job.
  - `rejectApplicant(userId, body)` — reject an applicant.
  - `listJobs(params?)` — list Recruiter job postings.
  - `createJob(body)` — create a Recruiter job posting.
  - `publishJob(jobId, body)` — publish a Recruiter job posting.
  - `solveJobCheckpoint(jobId, body)` — solve a job-posting checkpoint.
  - `listApplicants(jobId, params?)` — list applicants for a job.
  - `getApplicant(applicantId)` — fetch a single applicant.
  - `downloadResume(applicantId)` — download an applicant's resume.

- `curviate.account(id).search.*` (classic LinkedIn search):
  - `people(body)` — search people.
  - `companies(body)` — search companies.
  - `posts(body)` — search posts.
  - `jobs(body)` — search jobs.
  - `getParameters(query)` — fetch available search filter parameters.

- `curviate.webhooks.*`:
  - `create(body)` — register a new webhook endpoint.
  - `list(params?)` — list registered webhooks.
  - `update(id, body)` — update a webhook endpoint.
  - `delete(id)` — delete a webhook endpoint.
  - `listEvents()` — list available webhook event types.
  - `getStateDiff(accountId, params?)` — fetch an account state diff.

**Typed error model**
- `CurviateError` — single thrown type for all API errors, carrying a stable `code`, `httpStatus`, `retryHint`, `userFixable`, `retryLikelyToSucceed`, and `requiredTier`.
- `isCurviateError(err)` — type guard for narrowing in `catch` blocks.
- 34-member `ErrorCode` union covering every observable API error code.

**HTTP transport with retry and backoff**
- Exponential backoff with jitter for retryable GET/HEAD errors (configurable `maxRetries`).
- `Retry-After` header respected on 429 responses.
- Per-attempt abort controller timeout.
- JSON and binary (ArrayBuffer) response parsing.

**Cursor pagination**
- `curviate.paginate(method, params?)` — async iterator that follows the `cursor` field automatically.

**Webhook signature verification**
- `constructEvent(rawBody, signatureHeader, secret, opts?)` — verifies `HMAC-SHA256` webhook signatures using Web Crypto (`globalThis.crypto.subtle`); constant-time comparison prevents timing attacks; configurable replay window via `replayWindowSecs` (default 300 s). Always async — always `await` it.
- `WebhookSignatureError` — thrown on malformed header, invalid signature, or replay; not a `CurviateError`.
- `CurviateEvent` — 19-member discriminated union covering all canonical webhook event types.

**TypeScript types**
- Full OpenAPI-generated types at `src/generated/types.ts` — request bodies, responses, and path params.
- ESM-only build targeting ES2020; works in Node 18+, Cloudflare Workers, Vercel Edge.
