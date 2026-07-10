// accounts namespace methods (4, root-scoped: list/get/update/disconnect).
// The connect/checkpoint ops moved to `auth` (test/resources/auth.test.ts);
// createConnectLink/createReconnectLink/reconnect have no served op and were
// removed.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_accounts", baseUrl: BASE });

// ─── accounts.list (GET /v1/accounts) ────────────────────────────────────────
describe("accounts.list", () => {
  it("GET /v1/accounts returns a page of accounts", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json({
          object: "account_list",
          items: [{ account_id: "acc_1", status: "active" }],
          cursor: null,
        }),
      ),
    );
    const res = await client.accounts.list();
    expect(res.object).toBe("account_list");
    expect(res.items?.[0]?.account_id).toBe("acc_1");
  });

  it("forwards limit + cursor query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/accounts`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "account_list", items: [], cursor: null });
      }),
    );
    await client.accounts.list({ limit: 10, cursor: "c_abc" });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("limit")).toBe("10");
    expect(parsed.searchParams.get("cursor")).toBe("c_abc");
  });
});

// ─── accounts.get (GET /v1/accounts/:account_id) ─────────────────────────────
describe("accounts.get", () => {
  it("GET /v1/accounts/:account_id returns account detail", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts/acc_1`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1", status: "active", quotas: [] }),
      ),
    );
    const res = await client.accounts.get("acc_1");
    expect(res.account_id).toBe("acc_1");
    expect(Array.isArray(res.quotas)).toBe(true);
  });
});

// ─── accounts.update (PATCH /v1/accounts/:account_id) ────────────────────────
describe("accounts.update", () => {
  it("PATCH /v1/accounts/:account_id forwards metadata and returns updated account", async () => {
    let body: unknown;
    server.use(
      http.patch(`${BASE}/v1/accounts/acc_1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ object: "account", account_id: "acc_1" });
      }),
    );
    const res = await client.accounts.update("acc_1", { metadata: { team: "growth" } });
    expect(body).toEqual({ metadata: { team: "growth" } });
    expect(res.account_id).toBe("acc_1");
  });

  it("sets a custom proxy (password forwarded in the body only, never in the response)", async () => {
    let body: unknown;
    server.use(
      http.patch(`${BASE}/v1/accounts/acc_1`, async ({ request }) => {
        body = await request.json();
        // The server never echoes the proxy back — the 200 body is minimal.
        return HttpResponse.json({ object: "account", account_id: "acc_1" });
      }),
    );
    const res = await client.accounts.update("acc_1", {
      proxy: { protocol: "http", host: "proxy.example.com", port: 8080, username: "u", password: "s3cret" },
    });
    expect(body).toEqual({
      proxy: { protocol: "http", host: "proxy.example.com", port: 8080, username: "u", password: "s3cret" },
    });
    expect(JSON.stringify(res)).not.toContain("s3cret");
  });
});

// ─── accounts.disconnect (DELETE /v1/accounts/:account_id) ───────────────────
describe("accounts.disconnect", () => {
  it("DELETE /v1/accounts/:account_id returns archived account", async () => {
    server.use(
      http.delete(`${BASE}/v1/accounts/acc_1`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1", status: "archived" }),
      ),
    );
    const res = await client.accounts.disconnect("acc_1");
    expect(res.status).toBe("archived");
  });
});

// ─── accounts is unchanged by the auth split, reachable only from the root ──
describe("accounts is root-scoped", () => {
  it("is absent from the account(id) accessor", () => {
    const scoped = client.account("acc_test");
    expect((scoped as Record<string, unknown>)["accounts"]).toBeUndefined();
  });
});
