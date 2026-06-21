// Package entry point. The full public surface is assembled across the
// foundation chunks: Curviate client (sdk/001), CurviateError (sdk/003),
// transport (sdk/004), and the generated types (sdk/005).
export type { paths, components, operations } from "./generated/types.js";
export {
  CurviateError,
  isCurviateError,
  type ErrorCode,
  type RequiredTier,
  type RetryHint,
  type CurviateErrorInit,
  type CurviateErrorJSON,
} from "./errors.js";
