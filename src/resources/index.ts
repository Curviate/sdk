/**
 * Resource namespace assembly.
 *
 * The root client and every `account(id)` accessor expose the same set of
 * resource namespaces (sdk/001 FR-003). All 9 namespaces are fully implemented:
 * accounts, messaging, profiles, invites, search, posts (delegation 2A) +
 * salesNavigator, recruiter, webhooks (delegation 2B).
 */
import type { RequestContext } from "../internal/context.js";
import { AccountsResource } from "./accounts.js";
import { MessagingResource } from "./messaging.js";
import { ProfilesResource } from "./profiles.js";
import { InvitesResource } from "./invites.js";
import { SearchResource } from "./search.js";
import { PostsResource } from "./posts.js";
import { SalesNavigatorResource } from "./sales-navigator.js";
import { RecruiterResource } from "./recruiter.js";
import { WebhooksResource } from "./webhooks.js";

export { AccountsResource } from "./accounts.js";
export { MessagingResource } from "./messaging.js";
export { ProfilesResource } from "./profiles.js";
export { InvitesResource } from "./invites.js";
export { SearchResource } from "./search.js";
export { PostsResource } from "./posts.js";
export { SalesNavigatorResource } from "./sales-navigator.js";
export { RecruiterResource } from "./recruiter.js";
export { WebhooksResource } from "./webhooks.js";

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
