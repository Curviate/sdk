// sdk/001 — Curviate client, auth, config, account-scoped accessor, and the
// accounts.list() reference vertical slice (client → transport → generated
// types → error handling).
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";
import { CurviateError, isCurviateError } from "../src/errors.js";

const BASE = "https://app.curviate.test";

describe("Curviate constructor (FR-001, FR-005)", () => {
  // TS-001 (AC-001) — happy path, no network call.
  it("constructs without throwing and fires no network call", () => {
    const fetchSpy = vi.fn();
    expect(
      () => new Curviate({ apiKey: "cvt_live_abc", baseUrl: BASE, fetch: fetchSpy }),
    ).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // TS-002 (AC-002/003) — empty apiKey throws synchronously, no fetch.
  it("throws INVALID_REQUEST synchronously on an empty apiKey", () => {
    const fetchSpy = vi.fn();
    let caught: unknown;
    try {
      new Curviate({ apiKey: "", fetch: fetchSpy });
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // TS-003 (AC-002) — undefined apiKey coerced → throw.
  it("throws INVALID_REQUEST when apiKey is undefined", () => {
    expect(() => new Curviate({ apiKey: undefined as unknown as string })).toThrow(
      CurviateError,
    );
  });

  // TS-004 (AC-004) — defaults applied.
  it("applies default baseUrl / timeout / maxRetries", () => {
    const c = new Curviate({ apiKey: "k" });
    expect(c.config.baseUrl).toBe("https://api.curviate.com");
    expect(c.config.timeout).toBe(30_000);
    expect(c.config.maxRetries).toBe(3);
  });

  // FR-004 — immutable config (no setApiKey, frozen config view).
  it("exposes an immutable config view (FR-004)", () => {
    const c = new Curviate({ apiKey: "k" });
    expect(Object.isFrozen(c.config)).toBe(true);
    expect((c as unknown as Record<string, unknown>)["setApiKey"]).toBeUndefined();
  });
});

describe("accounts.list() reference slice (FR-002, sdk/004)", () => {
  // TS-005 (AC-005) — auth header on the outgoing request.
  it("sends Authorization: Bearer <apiKey> exactly", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${BASE}/v1/accounts`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ object: "account_list", items: [], cursor: null });
      }),
    );
    await new Curviate({ apiKey: "cvt_live_xyz", baseUrl: BASE }).accounts.list();
    expect(auth).toBe("Bearer cvt_live_xyz");
  });

  it("returns the parsed account list page", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json({
          object: "account_list",
          items: [{ account_id: "acc_1", status: "active" }],
          cursor: null,
        }),
      ),
    );
    const page = await new Curviate({ apiKey: "k", baseUrl: BASE }).accounts.list();
    expect(page.items?.[0]?.account_id).toBe("acc_1");
    expect(page.cursor).toBeNull();
  });

  it("forwards limit + cursor query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/accounts`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "account_list", items: [], cursor: null });
      }),
    );
    await new Curviate({ apiKey: "k", baseUrl: BASE }).accounts.list({ limit: 25, cursor: "cur_abc" });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("limit")).toBe("25");
    expect(parsed.searchParams.get("cursor")).toBe("cur_abc");
  });

  // The reference 401 path: server error envelope → typed CurviateError.
  it("maps a 401 to CurviateError without leaking the apiKey (Hard Rule #2)", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json(
          { code: "UNAUTHORIZED", message: "Invalid key.", user_fixable: false, retry_likely_to_succeed: false },
          { status: 401 },
        ),
      ),
    );
    const err = await new Curviate({ apiKey: "leak_me_not", baseUrl: BASE })
      .accounts.list()
      .catch((e: unknown) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("UNAUTHORIZED");
    expect((err as CurviateError).httpStatus).toBe(401);
    expect(JSON.stringify(err)).not.toContain("leak_me_not");
    expect(JSON.stringify(err)).not.toContain("Bearer");
  });
});

describe("account-scoped accessor (FR-003)", () => {
  // TS-007 (AC-008) — account('') throws synchronously.
  it("throws INVALID_REQUEST synchronously on an empty account id", () => {
    const c = new Curviate({ apiKey: "k", baseUrl: BASE });
    let caught: unknown;
    try {
      c.account("");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
  });

  // TS-006 (AC-006) — same resource namespaces as the root client.
  it("exposes the documented resource namespaces", () => {
    const scoped = new Curviate({ apiKey: "k", baseUrl: BASE }).account("acc_123");
    for (const ns of [
      "messaging",
      "profiles",
      "invites",
      "search",
      "posts",
      "salesNavigator",
      "recruiter",
      "webhooks",
    ]) {
      expect(scoped, `namespace ${ns} should exist`).toHaveProperty(ns);
    }
  });

  it("returns a fresh accessor object per call (no shared mutable state, FR-004)", () => {
    const c = new Curviate({ apiKey: "k", baseUrl: BASE });
    expect(c.account("acc_1")).not.toBe(c.account("acc_2"));
  });
});
