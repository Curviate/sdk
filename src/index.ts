// @curviate/sdk — the official TypeScript SDK for the Curviate API.
//
// Entry point. Re-exports the client, the typed error model, and the generated
// request/response types. The webhook-receiving surface (constructEvent,
// CurviateEvent, WebhookSignatureError) is added by a later delegation.

export { Curviate } from "./client.js";
export type {
  CurviateConfig,
  ResolvedConfig,
} from "./config.js";

export {
  CurviateError,
  isCurviateError,
  type ErrorCode,
  type RequiredTier,
  type RetryHint,
  type CurviateErrorInit,
  type CurviateErrorJSON,
} from "./errors.js";

export type {
  AccountListPage,
  AccountListParams,
} from "./resources/accounts.js";

export type {
  ResourceNamespaces,
  AccountScopedNamespaces,
} from "./resources/index.js";

export type { paths, components, operations } from "./generated/types.js";
