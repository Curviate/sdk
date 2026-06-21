/**
 * Resource namespace assembly.
 *
 * The root client and every `account(id)` accessor expose the same set of
 * resource namespaces (sdk/001 FR-003). `accounts` is fully wired here as the
 * reference slice; the remaining eight namespaces are present-but-stubbed —
 * delegation 2 (sdk/002) implements their methods following the
 * {@link AccountsResource} pattern. They exist as objects so AC-006 (namespace
 * parity between root and account-scoped clients) holds today.
 */
import type { RequestContext } from "../internal/context.js";
import { AccountsResource } from "./accounts.js";

export { AccountsResource } from "./accounts.js";

/**
 * Placeholder for a not-yet-implemented namespace (delegation 2). It is a real
 * object (so the namespace exists per FR-003) carrying the bound context, ready
 * for its methods to be added. Calling no method on it is a no-op.
 */
class StubResource {
  constructor(protected readonly ctx: RequestContext) {}
}

export class MessagingResource extends StubResource {}
export class ProfilesResource extends StubResource {}
export class InvitesResource extends StubResource {}
export class SearchResource extends StubResource {}
export class PostsResource extends StubResource {}
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
