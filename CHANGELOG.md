# Changelog

All notable changes to `@curviate/sdk` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: semantic — minor for additive changes, patch for bug fixes; no stability promise before 1.0.

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
