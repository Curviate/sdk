/**
 * Resource namespace assembly.
 *
 * The root client and every `account(id)` accessor expose the same set of
 * resource namespaces (sdk/001 FR-003). Accounts, messaging, profiles, invites,
 * search, and posts are fully implemented (delegation 2A). The remaining
 * namespaces (salesNavigator, recruiter, webhooks) are implemented in
 * delegation 2B and kept as stubs here so AC-006 (namespace parity between
 * root and account-scoped clients) holds in the interim.
 */
import type { RequestContext } from "../internal/context.js";
import { AccountsResource } from "./accounts.js";
import { MessagingResource } from "./messaging.js";
import { ProfilesResource } from "./profiles.js";
import { InvitesResource } from "./invites.js";
import { SearchResource } from "./search.js";
import { PostsResource } from "./posts.js";

export { AccountsResource } from "./accounts.js";
export { MessagingResource } from "./messaging.js";
export { ProfilesResource } from "./profiles.js";
export { InvitesResource } from "./invites.js";
export { SearchResource } from "./search.js";
export { PostsResource } from "./posts.js";

/**
 * Placeholder for a not-yet-implemented namespace (delegation 2B). It is a real
 * object (so the namespace exists per FR-003) carrying the bound context, ready
 * for its methods to be added. Calling no method on it is a no-op.
 */
class StubResource {
  constructor(protected readonly ctx: RequestContext) {}
}

export class SalesNavigatorResource extends StubResource {}
export class RecruiterResource extends StubResource {}
export class WebhooksResource extends StubResource {}

/** The full namespace surface, shared by the root client and account scopes. */
export interface ResourceNamespaces {
  accounts: AccountsResource;
  messaging: MessagingResource;
  profiles: ProfilesResource;
  invites: InvitesResource;
  search: SearchResource;
  posts: PostsResource;
  salesNavigator: SalesNavigatorResource;
  recruiter: RecruiterResource;
  webhooks: WebhooksResource;
}

/** Build the namespace bag for a given request context. */
export function buildNamespaces(ctx: RequestContext): ResourceNamespaces {
  return {
    accounts: new AccountsResource(ctx),
    messaging: new MessagingResource(ctx),
    profiles: new ProfilesResource(ctx),
    invites: new InvitesResource(ctx),
    search: new SearchResource(ctx),
    posts: new PostsResource(ctx),
    salesNavigator: new SalesNavigatorResource(ctx),
    recruiter: new RecruiterResource(ctx),
    webhooks: new WebhooksResource(ctx),
  };
}

/**
 * The account-scoped accessor surface — every namespace except `accounts`
 * itself (account-level operations are the root client's concern). The fixed
 * `account_id` is injected by the bound context.
 */
export type AccountScopedNamespaces = Omit<ResourceNamespaces, "accounts">;

/** Build the account-scoped namespace bag (drops `accounts`). */
export function buildAccountScopedNamespaces(
  ctx: RequestContext,
): AccountScopedNamespaces {
  const { accounts: _accounts, ...rest } = buildNamespaces(ctx);
  void _accounts;
  return rest;
}
