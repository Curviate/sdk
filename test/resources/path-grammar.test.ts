// Path-grammar bank — the account-first `/v1/{account_id}/…` grammar proven at
// the resource-wrapper level (the seam itself is proven directly against
// `createContext` in test/internal/context.test.ts).
//
// Every account-scoped method must build a URL whose account id is the FIRST
// `/v1/` path segment; every root-scoped method must build a URL with NO
// account segment at all, and `account_id` must never leak into the query
// string for either. Table-driven: this file owns the runner (`CASES` + the
// `it.each` below); later resource chunks (messaging / users / recruiter /
// sales-navigator / jobs / comments / posts / invites / search / companies)
// append their own account-scoped rows to `CASES` as they realign, without
// touching the runner.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const ACCOUNT_ID = "acc_test";

interface CapturedRequest {
  path: string;
  search: URLSearchParams;
}

interface PathGrammarCase {
  /** `<namespace>.<method>` — purely descriptive, shows up in the test name. */
  name: string;
  /** `"account"` rows must lead with `/v1/acc_test/`; `"root"` rows must not. */
  scope: "root" | "account";
  /**
   * Register the matching MSW handler, issue the call against `client`, and
   * return the captured request's path + query. `client` is always the root
   * `Curviate` instance — an account-scoped row calls
   * `client.account(ACCOUNT_ID).<namespace>.<method>()` itself.
   */
  run: (client: Curviate) => Promise<CapturedRequest>;
}

const CASES: PathGrammarCase[] = [
  // ─── Root-scoped: accounts ────────────────────────────────────────────────
  {
    name: "accounts.list",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/accounts`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "account_list", items: [], cursor: null });
        }),
      );
      await client.accounts.list();
      return captured!;
    },
  },
  {
    name: "accounts.get",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/accounts/${ACCOUNT_ID}`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "account", account_id: ACCOUNT_ID, status: "active", quotas: [] });
        }),
      );
      await client.accounts.get(ACCOUNT_ID);
      return captured!;
    },
  },

  // ─── Root-scoped: auth — account_id (when present) is a body field, never
  // a path segment or query param.
  {
    name: "auth.intent",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/auth/intent`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json(
            { object: "account", account_id: "acc_1", status: "active" },
            { status: 201 },
          );
        }),
      );
      await client.auth.intent({
        seat_id: "seat_1",
        auth_method: "credentials",
        credentials: { email: "u@x.com", password: "p" },
      });
      return captured!;
    },
  },
  {
    name: "auth.getSession",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/auth/sessions/acc_prov`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({
            object: "auth_session",
            session_id: "acc_prov",
            status: "done",
            account_id: "acc_1",
          });
        }),
      );
      await client.auth.getSession("acc_prov");
      return captured!;
    },
  },

  // ─── Root-scoped: webhooks ────────────────────────────────────────────────
  {
    name: "webhooks.list",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/webhooks`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "webhook_list", items: [], cursor: null });
        }),
      );
      await client.webhooks.list();
      return captured!;
    },
  },
  {
    name: "webhooks.get",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/webhooks/wh_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "webhook", id: "wh_1", source: "messaging" });
        }),
      );
      await client.webhooks.get("wh_1");
      return captured!;
    },
  },

  // ─── Later chunks append their own account-scoped rows here, e.g.:
  //
  //   {
  //     name: "messaging.listChats",
  //     scope: "account",
  //     run: async (client) => {
  //       let captured: CapturedRequest | undefined;
  //       server.use(
  //         http.get(`${BASE}/v1/${ACCOUNT_ID}/chats`, ({ request }) => {
  //           const url = new URL(request.url);
  //           captured = { path: url.pathname, search: url.searchParams };
  //           return HttpResponse.json({ object: "chat_list", items: [], cursor: null });
  //         }),
  //       );
  //       await client.account(ACCOUNT_ID).messaging.listChats();
  //       return captured!;
  //     },
  //   },
];

describe("path grammar — account-first for account-scoped, verbatim for root", () => {
  it.each(CASES.map((c): [string, PathGrammarCase] => [c.name, c]))("%s", async (_name, c) => {
    const client = new Curviate({ apiKey: "cvt_test_pathgrammar", baseUrl: BASE });
    const { path, search } = await c.run(client);

    if (c.scope === "account") {
      expect(path.startsWith(`/v1/${ACCOUNT_ID}/`)).toBe(true);
    } else {
      // Root-scoped: the account id (this bank never binds one via
      // `account(id)`) must never appear as the leading path segment.
      expect(path.startsWith(`/v1/${ACCOUNT_ID}/`)).toBe(false);
    }
    // account_id is never a query param — for either scope.
    expect(search.has("account_id")).toBe(false);
  });
});
