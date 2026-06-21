# Changelog

All notable changes to `@curviate/sdk` are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning: semantic — minor for additive changes, patch for bug fixes; no stability promise before 1.0.

---

## [0.1.0] — 2026-06-21

Initial public release.

### Added

**Client and auth**
- `new Curviate({ apiKey })` — configures the SDK with a Bearer API key, base URL, timeout, and max retries.
- `curviate.account(accountId)` — returns an account-scoped accessor; all LinkedIn operations are tied to a managed account.

**80-method resource surface**
- `curviate.accounts.*` — list, get, create (cookie/key link), reconnect, refresh, delete managed accounts; checkpoint submit/poll/resend; state-diff.
- `curviate.account(id).messaging.*` — list chats, get chat, list messages, send, edit, delete, react, sync chat history, chat status.
- `curviate.account(id).profiles.*` — get profile (classic/Sales Navigator/Recruiter), list followers/following, list posts, list reactions, list post comments.
- `curviate.account(id).invites.*` — list received/sent invitations, send invite, cancel invite, handle received invite.
- `curviate.account(id).posts.*` — create post, get post, list own posts, send post comment, send reaction, list post comments, list post reactions.
- `curviate.account(id).salesNavigator.*` — search people, search companies, get lead, get account, save lead, save account, unsave lead, unsave account.
- `curviate.account(id).recruiter.*` — search candidates, get candidate, save candidate, list job applicants, list talent pools, list recruiter projects, add to project, remove from project, send InMail, list pipelines.
- `curviate.account(id).search.*` — people search (classic LinkedIn).
- `curviate.webhooks.*` — create, list, update, delete webhooks; list event catalogue; get account state-diff.

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
- `curviate.paginate(method, params?)` — async iterator that follows `next_cursor` automatically.

**Webhook signature verification**
- `constructEvent(rawBody, signatureHeader, secret, opts?)` — verifies `HMAC-SHA256` webhook signatures; constant-time comparison prevents timing attacks; configurable replay window (default 5 minutes).
- `WebhookSignatureError` — thrown on malformed header, invalid signature, or replay; not a `CurviateError`.
- `CurviateEvent` — 19-member discriminated union covering all canonical webhook event types.

**TypeScript types**
- Full OpenAPI-generated types at `src/generated/types.ts` — request bodies, responses, and path params.
- ESM-only build targeting ES2020; works in Node 18+, Cloudflare Workers, Vercel Edge.
