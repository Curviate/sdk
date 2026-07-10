/**
 * Resource namespace assembly.
 *
 * The root client and every `account(id)` accessor expose the same bag of
 * resource namespaces, minus the root-only ones. `accounts` and `auth` are
 * root-scoped (connected-account and connect/reconnect management are not
 * per-account concepts) and are stripped out of the `account(id)` accessor by
 * {@link buildAccountScopedNamespaces}.
 */
import type { RequestContext } from "../internal/context.js";
import { AccountsResource } from "./accounts.js";
import { AuthResource } from "./auth.js";
import { MessagingResource } from "./messaging.js";
import { UsersResource } from "./users.js";
import { InvitesResource } from "./invites.js";
import { SearchResource } from "./search.js";
import { PostsResource } from "./posts.js";
import { CommentsResource } from "./comments.js";
import { SalesNavigatorResource } from "./sales-navigator.js";
import { RecruiterResource } from "./recruiter.js";
import { JobsResource } from "./jobs.js";
import { CompaniesResource } from "./companies.js";
import { WebhooksResource } from "./webhooks.js";

export { AccountsResource } from "./accounts.js";
export { AuthResource } from "./auth.js";
export { MessagingResource } from "./messaging.js";
export { UsersResource } from "./users.js";
export { InvitesResource } from "./invites.js";
export { SearchResource } from "./search.js";
export { PostsResource } from "./posts.js";
export { CommentsResource } from "./comments.js";
export { SalesNavigatorResource } from "./sales-navigator.js";
export { RecruiterResource } from "./recruiter.js";
export { JobsResource } from "./jobs.js";
export { CompaniesResource } from "./companies.js";
export { WebhooksResource } from "./webhooks.js";

/** The full namespace surface, shared by the root client and account scopes. */
export interface ResourceNamespaces {
  accounts: AccountsResource;
  auth: AuthResource;
  messaging: MessagingResource;
  users: UsersResource;
  invites: InvitesResource;
  search: SearchResource;
  posts: PostsResource;
  comments: CommentsResource;
  salesNavigator: SalesNavigatorResource;
  recruiter: RecruiterResource;
  jobs: JobsResource;
  companies: CompaniesResource;
  webhooks: WebhooksResource;
}

/** Build the namespace bag for a given request context. */
export function buildNamespaces(ctx: RequestContext): ResourceNamespaces {
  return {
    accounts: new AccountsResource(ctx),
    auth: new AuthResource(ctx),
    messaging: new MessagingResource(ctx),
    users: new UsersResource(ctx),
    invites: new InvitesResource(ctx),
    search: new SearchResource(ctx),
    posts: new PostsResource(ctx),
    comments: new CommentsResource(ctx),
    salesNavigator: new SalesNavigatorResource(ctx),
    recruiter: new RecruiterResource(ctx),
    jobs: new JobsResource(ctx),
    companies: new CompaniesResource(ctx),
    webhooks: new WebhooksResource(ctx),
  };
}

/**
 * The account-scoped accessor surface — every namespace except the root-only
 * `accounts` and `auth` (connected-account and connect/reconnect management
 * are not per-account concepts). The fixed `account_id` is injected by the
 * bound context.
 */
export type AccountScopedNamespaces = Omit<ResourceNamespaces, "accounts" | "auth">;

/** Build the account-scoped namespace bag (drops `accounts` and `auth`). */
export function buildAccountScopedNamespaces(
  ctx: RequestContext,
): AccountScopedNamespaces {
  const { accounts: _accounts, auth: _auth, ...rest } = buildNamespaces(ctx);
  void _accounts;
  void _auth;
  return rest;
}
