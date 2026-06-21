/**
 * The Curviate client (sdk/001).
 *
 * `new Curviate({ apiKey })` is the single entry point. The instance is
 * immutable: config is resolved + frozen in the constructor (FR-004), and the
 * constructor makes no network call (FR-001). Resource namespaces are mounted
 * on the instance; `account(id)` returns an account-scoped view that fixes
 * `account_id` on every call (FR-003).
 */
import {
  resolveConfig,
  type CurviateConfig,
  type ResolvedConfig,
} from "./config.js";
import { CurviateError } from "./errors.js";
import { createContext } from "./internal/context.js";
import {
  buildNamespaces,
  buildAccountScopedNamespaces,
  type AccountScopedNamespaces,
  type AccountsResource,
  type MessagingResource,
  type ProfilesResource,
  type InvitesResource,
  type SearchResource,
  type PostsResource,
  type SalesNavigatorResource,
  type RecruiterResource,
  type WebhooksResource,
} from "./resources/index.js";

export class Curviate {
  /** Frozen, fully-resolved config (FR-004). */
  readonly config: ResolvedConfig;

  readonly accounts: AccountsResource;
  readonly messaging: MessagingResource;
  readonly profiles: ProfilesResource;
  readonly invites: InvitesResource;
  readonly search: SearchResource;
  readonly posts: PostsResource;
  readonly salesNavigator: SalesNavigatorResource;
  readonly recruiter: RecruiterResource;
  readonly webhooks: WebhooksResource;

  constructor(config: CurviateConfig) {
    this.config = resolveConfig(config);
    const ctx = createContext(this.config);
    const ns = buildNamespaces(ctx);
    this.accounts = ns.accounts;
    this.messaging = ns.messaging;
    this.profiles = ns.profiles;
    this.invites = ns.invites;
    this.search = ns.search;
    this.posts = ns.posts;
    this.salesNavigator = ns.salesNavigator;
    this.recruiter = ns.recruiter;
    this.webhooks = ns.webhooks;
  }

  /**
   * Return an account-scoped accessor that fixes `account_id` on every call,
   * so callers need not repeat it per method (FR-003).
   *
   * @param accountId - a Curviate account id (`acc_…`). Empty throws
   *   `CurviateError({ code: 'INVALID_REQUEST' })` synchronously, no network call.
   *
   * @example
   * await curviate.account("acc_123").messaging.listChats();
   */
  account(accountId: string): AccountScopedNamespaces {
    if (typeof accountId !== "string" || accountId.length === 0) {
      throw new CurviateError({
        code: "INVALID_REQUEST",
        message: "account(accountId) requires a non-empty account id.",
        userFixable: true,
        retryLikelyToSucceed: false,
      });
    }
    const ctx = createContext(this.config, accountId);
    return buildAccountScopedNamespaces(ctx);
  }
}
