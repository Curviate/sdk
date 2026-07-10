/**
 * The Curviate client.
 *
 * `new Curviate({ apiKey })` is the single entry point. The instance is
 * immutable: config is resolved + frozen in the constructor, and the
 * constructor makes no network call. Resource namespaces are mounted
 * on the instance; `account(id)` returns an account-scoped view that fixes
 * `account_id` on every call.
 *
 * `paginate(method, params)` follows the `cursor` field transparently across
 * pages, yielding individual items as an `AsyncIterableIterator`.
 */
import {
  resolveConfig,
  type CurviateConfig,
  type ResolvedConfig,
} from "./config.js";
import { CurviateError } from "./errors.js";
import { createContext } from "./internal/context.js";
import {
  paginate as paginateImpl,
  type PaginatableMethod,
} from "./internal/paginate.js";
import {
  buildNamespaces,
  buildAccountScopedNamespaces,
  type AccountScopedNamespaces,
  type AccountsResource,
  type AuthResource,
  type MessagingResource,
  type ProfilesResource,
  type InvitesResource,
  type SearchResource,
  type PostsResource,
  type SalesNavigatorResource,
  type RecruiterResource,
  type JobsResource,
  type CompaniesResource,
  type WebhooksResource,
} from "./resources/index.js";

export class Curviate {
  /** Frozen, fully-resolved config. */
  readonly config: ResolvedConfig;

  readonly accounts: AccountsResource;
  readonly auth: AuthResource;
  readonly messaging: MessagingResource;
  readonly profiles: ProfilesResource;
  readonly invites: InvitesResource;
  readonly search: SearchResource;
  readonly posts: PostsResource;
  readonly salesNavigator: SalesNavigatorResource;
  readonly recruiter: RecruiterResource;
  readonly jobs: JobsResource;
  readonly companies: CompaniesResource;
  readonly webhooks: WebhooksResource;

  constructor(config: CurviateConfig) {
    this.config = resolveConfig(config);
    const ctx = createContext(this.config);
    const ns = buildNamespaces(ctx);
    this.accounts = ns.accounts;
    this.auth = ns.auth;
    this.messaging = ns.messaging;
    this.profiles = ns.profiles;
    this.invites = ns.invites;
    this.search = ns.search;
    this.posts = ns.posts;
    this.salesNavigator = ns.salesNavigator;
    this.recruiter = ns.recruiter;
    this.jobs = ns.jobs;
    this.companies = ns.companies;
    this.webhooks = ns.webhooks;
  }

  /**
   * Return an account-scoped accessor that fixes `account_id` on every call,
   * so callers need not repeat it per method.
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

  /**
   * Transparent cursor-pagination iterator.
   *
   * Calls `fn` repeatedly, injecting the `cursor` from each response into the
   * next call, yielding individual items until `cursor` is null.
   *
   * @param fn     - a bound resource method (e.g. `profiles.listConnections.bind(profiles)`)
   * @param params - the initial params (minus cursor)
   *
   * @example
   * for await (const profile of curviate.paginate(
   *   curviate.account('acc_123').profiles.listConnections,
   *   { limit: 50 }
   * )) {
   *   console.log(profile);
   * }
   */
  paginate<TParams extends Record<string, unknown>, TPage extends { items?: unknown[]; data?: unknown[]; cursor?: string | null }>(
    fn: PaginatableMethod<TParams, TPage>,
    params: TParams,
  ): AsyncIterableIterator<TPage extends { items?: Array<infer I> | undefined } ? I : TPage extends { data?: Array<infer D> | undefined } ? D : unknown> {
    return paginateImpl(fn, params) as AsyncIterableIterator<TPage extends { items?: Array<infer I> | undefined } ? I : TPage extends { data?: Array<infer D> | undefined } ? D : unknown>;
  }
}
