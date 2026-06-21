/**
 * Cursor pagination helper (sdk/002 FR-003).
 *
 * `paginate(fn, params)` returns an `AsyncIterableIterator` that transparently
 * follows the `cursor` field in each page response, yielding individual items
 * from `items` (or `data`) until `cursor` is null or absent.
 *
 * Callers who want raw page envelopes call the underlying method directly.
 *
 * @example
 * for await (const profile of curviate.paginate(
 *   curviate.account('acc_123').profiles.listConnections,
 *   { limit: 50 }
 * )) {
 *   console.log(profile);
 * }
 */

/** Minimal shape every paginated page response must satisfy. */
interface PageEnvelope {
  items?: unknown[];
  data?: unknown[];
  cursor?: string | null;
}

/**
 * A method that accepts params (with optional cursor) and returns a page.
 * The params type must at least allow `cursor?: string` to be injected.
 */
export type PaginatableMethod<TParams extends Record<string, unknown>, TPage extends PageEnvelope> =
  (params: TParams & { cursor?: string }) => Promise<TPage>;

/**
 * Infer the element type of `items` or `data` in a page envelope.
 * Falls back to `unknown` if neither is present.
 */
type ItemOf<TPage extends PageEnvelope> =
  TPage extends { items?: Array<infer I> | undefined } ? I :
  TPage extends { data?: Array<infer D> | undefined } ? D :
  unknown;

/**
 * Transparent cursor-pagination iterator.
 *
 * @param fn     - a bound resource method (e.g. `profiles.listConnections.bind(profiles)`)
 * @param params - the initial params (minus cursor); cursor is injected per page
 * @returns an `AsyncIterableIterator` of individual items across all pages
 */
export async function* paginate<
  TParams extends Record<string, unknown>,
  TPage extends PageEnvelope,
>(
  fn: PaginatableMethod<TParams, TPage>,
  params: TParams,
): AsyncIterableIterator<ItemOf<TPage>> {
  let cursor: string | null | undefined = undefined;

  for (;;) {
    const callParams = cursor != null ? { ...params, cursor } : { ...params };
    const page = await fn(callParams as TParams & { cursor?: string });

    const items = (page.items ?? page.data ?? []) as ItemOf<TPage>[];
    for (const item of items) {
      yield item;
    }

    // Terminate when cursor is null (last page) or absent (non-paginated endpoint).
    cursor = page.cursor;
    if (cursor == null) break;
  }
}
