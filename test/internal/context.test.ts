// Path-grammar foundation — the account-first `/v1/{account_id}/…` seam.
//
// The account-scoped context (`curviate.account(id)`) no longer injects
// `account_id` as a query param, body field, or `none`. Instead a method
// declares its path template with an `{account_id}` placeholder and the bound
// context substitutes the fixed account id into that leading path segment.
// Root-scoped contexts (accounts / auth / webhooks — created with no account
// id) build paths verbatim, with no account segment and no injection.
//
// These tests exercise `createContext` directly (not through the resource
// wrappers, which realign separately) with an injected capturing `fetch`, so
// the foundation grammar is proven independent of any wrapper.
import { describe, expect, it } from "vitest";
import { createContext } from "../../src/internal/context.js";
import type { ResolvedConfig } from "../../src/config.js";

const BASE = "https://app.curviate.test";

interface Captured {
  url: URL;
  method: string;
  rawBody: BodyInit | null | undefined;
}

/** A frozen config whose `fetch` records every outgoing request. */
function withCapture(): { config: ResolvedConfig; captured: Captured[] } {
  const captured: Captured[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    captured.push({
      url: new URL(urlStr),
      method: init?.method ?? "GET",
      rawBody: init?.body,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const config: ResolvedConfig = Object.freeze({
    apiKey: "cvt_test_ctx",
    baseUrl: BASE,
    timeout: 30_000,
    maxRetries: 0,
    fetch: fetchImpl,
  });
  return { config, captured };
}

/** Parse a captured JSON request body (or `undefined` when bodyless). */
function bodyOf(c: Captured): Record<string, unknown> | undefined {
  if (typeof c.rawBody !== "string") return undefined;
  return JSON.parse(c.rawBody) as Record<string, unknown>;
}

// ─── Account-scoped: `{account_id}` becomes the leading path segment ─────────
describe("account-first path grammar — account-scoped context", () => {
  it("substitutes {account_id} with the fixed id as the leading /v1 segment", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({ method: "GET", path: "/v1/{account_id}/chats" });

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url.pathname).toBe("/v1/acc_test/chats");
    // account_id never leaks into the query string.
    expect(captured[0]!.url.searchParams.has("account_id")).toBe(false);
  });

  it("substitutes when the template carries further interpolated segments", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({
      method: "GET",
      path: "/v1/{account_id}/chats/chat_123/messages",
    });

    expect(captured[0]!.url.pathname).toBe("/v1/acc_test/chats/chat_123/messages");
  });

  it("keeps a literal `me` segment intact (users.get('me') → /v1/{aid}/users/me)", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({ method: "GET", path: "/v1/{account_id}/users/me" });

    expect(captured[0]!.url.pathname).toBe("/v1/acc_test/users/me");
  });

  it.each([
    ["/v1/{account_id}/chats", "/v1/acc_test/chats"],
    ["/v1/{account_id}/profiles/relations", "/v1/acc_test/profiles/relations"],
    ["/v1/{account_id}/recruiter/projects", "/v1/acc_test/recruiter/projects"],
    ["/v1/{account_id}/sales-navigator/account-lists", "/v1/acc_test/sales-navigator/account-lists"],
    ["/v1/{account_id}/posts/post_1/reactions", "/v1/acc_test/posts/post_1/reactions"],
    ["/v1/{account_id}/inmail-credits", "/v1/acc_test/inmail-credits"],
  ])("parametrized: %s → %s", async (template, expected) => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({ method: "GET", path: template });

    expect(captured[0]!.url.pathname).toBe(expected);
    expect(captured[0]!.url.searchParams.has("account_id")).toBe(false);
  });

  it("preserves a caller query and never adds account_id to it", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({
      method: "GET",
      path: "/v1/{account_id}/chats",
      query: { limit: 10, cursor: "abc" },
    });

    const sp = captured[0]!.url.searchParams;
    expect(sp.get("limit")).toBe("10");
    expect(sp.get("cursor")).toBe("abc");
    expect(sp.has("account_id")).toBe(false);
  });

  it("never injects account_id into a JSON write body", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({
      method: "POST",
      path: "/v1/{account_id}/posts/post_1/reactions",
      body: { reaction: "like" },
    });

    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.url.pathname).toBe("/v1/acc_test/posts/post_1/reactions");
    // Body is exactly what the caller sent — no injected account_id key.
    expect(bodyOf(captured[0]!)).toEqual({ reaction: "like" });
  });

  it("does not mutate the caller-supplied body object", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");
    const body = { reaction: "like" };

    await ctx.request({
      method: "POST",
      path: "/v1/{account_id}/posts/post_1/reactions",
      body,
    });

    // The original object is untouched — no account_id property added.
    expect(Object.keys(body)).toEqual(["reaction"]);
    void captured;
  });

  it("sends NO request body for a bodyless write (e.g. follow)", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({
      method: "POST",
      path: "/v1/{account_id}/users/ACo1/follow",
    });

    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.url.pathname).toBe("/v1/acc_test/users/ACo1/follow");
    expect(captured[0]!.rawBody).toBeUndefined();
  });

  it("carries a body on a DELETE-with-body op (e.g. unreact)", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config, "acc_test");

    await ctx.request({
      method: "DELETE",
      path: "/v1/{account_id}/posts/post_1/reactions",
      body: { reaction: "like" },
    });

    expect(captured[0]!.method).toBe("DELETE");
    expect(captured[0]!.url.pathname).toBe("/v1/acc_test/posts/post_1/reactions");
    expect(bodyOf(captured[0]!)).toEqual({ reaction: "like" });
  });
});

// ─── Root-scoped: no account segment, no injection ──────────────────────────
describe("account-first path grammar — root-scoped context (no account id)", () => {
  it("uses a root path verbatim — no account segment, no account_id query", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config); // no account id → root client

    await ctx.request({ method: "GET", path: "/v1/webhooks" });

    expect(captured[0]!.url.pathname).toBe("/v1/webhooks");
    expect(captured[0]!.url.searchParams.has("account_id")).toBe(false);
  });

  it("leaves a root resource-id path (accounts/{id}) untouched", async () => {
    const { config, captured } = withCapture();
    const ctx = createContext(config);

    await ctx.request({ method: "GET", path: "/v1/accounts/acc_abc" });

    expect(captured[0]!.url.pathname).toBe("/v1/accounts/acc_abc");
    expect(captured[0]!.url.searchParams.has("account_id")).toBe(false);
  });

  it("exposes accountId === undefined for a root context", () => {
    const { config } = withCapture();
    const ctx = createContext(config);
    expect(ctx.accountId).toBeUndefined();
  });
});

// ─── The bound context exposes its fixed account id ─────────────────────────
describe("createContext — accountId accessor", () => {
  it("exposes the fixed account id for an account-scoped context", () => {
    const { config } = withCapture();
    const ctx = createContext(config, "acc_test");
    expect(ctx.accountId).toBe("acc_test");
  });
});
