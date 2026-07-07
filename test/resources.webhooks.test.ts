// webhooks namespace (7 methods; root-scoped — W2 added get())
// MSW happy-path for every method + coverage test asserting 94 total methods.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_webhooks", baseUrl: BASE });

// ─── webhooks.create (POST /v1/webhooks) ─────────────────────────────────────
describe("webhooks.create", () => {
  it("POST /v1/webhooks creates a webhook and returns the secret once", async () => {
    server.use(
      http.post(`${BASE}/v1/webhooks`, () =>
        HttpResponse.json(
          {
            object: "webhook",
            id: "wh_1",
            source: "messaging",
            request_url: "https://example.com/hook",
            secret: "sk_1234567890abcdef",
            secret_prefix: "sk_12345",
          },
          { status: 201 },
        ),
      ),
    );
    const res = await client.webhooks.create({
      source: "messaging",
      request_url: "https://example.com/hook",
      account_ids: ["acc_1"],
    });
    expect(res.id).toBe("wh_1");
    expect(res.secret).toBeDefined(); // returned only on creation
  });
});

// ─── webhooks.list (GET /v1/webhooks) ─────────────────────────────────────────
describe("webhooks.list", () => {
  it("GET /v1/webhooks returns paginated webhook list", async () => {
    server.use(
      http.get(`${BASE}/v1/webhooks`, () =>
        HttpResponse.json({ object: "webhook_list", items: [], cursor: null }),
      ),
    );
    const res = await client.webhooks.list();
    expect(res.object).toBe("webhook_list");
    expect(Array.isArray(res.items)).toBe(true);
  });

  it("forwards limit + cursor query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/webhooks`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "webhook_list", items: [], cursor: null });
      }),
    );
    await client.webhooks.list({ limit: 10, cursor: "c_abc" });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("limit")).toBe("10");
    expect(parsed.searchParams.get("cursor")).toBe("c_abc");
  });
});

// ─── webhooks.listEvents (GET /v1/webhooks/events) ────────────────────────────
describe("webhooks.listEvents", () => {
  it("GET /v1/webhooks/events returns event catalogue", async () => {
    server.use(
      http.get(`${BASE}/v1/webhooks/events`, () =>
        HttpResponse.json({ object: "webhook_event_catalogue", sources: [] }),
      ),
    );
    const res = await client.webhooks.listEvents();
    expect(res.object).toBe("webhook_event_catalogue");
  });
});

// ─── webhooks.get (GET /v1/webhooks/:id) — net-new ───────────────────────────
describe("webhooks.get", () => {
  it("GET /v1/webhooks/:id returns the webhook (no plaintext secret)", async () => {
    server.use(
      http.get(`${BASE}/v1/webhooks/wh_1`, () =>
        HttpResponse.json({
          object: "webhook",
          id: "wh_1",
          source: "messaging",
          request_url: "https://example.com/hook",
          secret_prefix: "sk_12345",
        }),
      ),
    );
    const res = await client.webhooks.get("wh_1");
    expect(res.object).toBe("webhook");
    expect(res.id).toBe("wh_1");
    expect((res as Record<string, unknown>)["secret"]).toBeUndefined();
  });

  it("404s for a webhook not owned by the tenant", async () => {
    server.use(
      http.get(`${BASE}/v1/webhooks/wh_missing`, () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Webhook not found." } },
          { status: 404 },
        ),
      ),
    );
    await expect(client.webhooks.get("wh_missing")).rejects.toBeDefined();
  });
});

// ─── webhooks.update (PATCH /v1/webhooks/:id) ─────────────────────────────────
describe("webhooks.update", () => {
  it("PATCH /v1/webhooks/:id returns updated webhook", async () => {
    server.use(
      http.patch(`${BASE}/v1/webhooks/wh_1`, () =>
        HttpResponse.json({
          object: "webhook",
          id: "wh_1",
          source: "messaging",
          enabled: false,
        }),
      ),
    );
    const res = await client.webhooks.update("wh_1", { enabled: false });
    expect(res.id).toBe("wh_1");
    expect(res.enabled).toBe(false);
  });
});

// ─── webhooks.delete (DELETE /v1/webhooks/:id) ────────────────────────────────
describe("webhooks.delete", () => {
  it("DELETE /v1/webhooks/:id returns deleted shape", async () => {
    server.use(
      http.delete(`${BASE}/v1/webhooks/wh_1`, () =>
        HttpResponse.json({ object: "webhook_deleted", id: "wh_1" }),
      ),
    );
    const res = await client.webhooks.delete("wh_1");
    expect(res.object).toBe("webhook_deleted");
    expect(res.id).toBe("wh_1");
  });
});

// ─── webhooks.getStateDiff (GET /v1/accounts/:id/state-diff) ─────────────────
describe("webhooks.getStateDiff", () => {
  it("GET /v1/accounts/:id/state-diff returns state diff", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts/acc_1/state-diff`, () =>
        HttpResponse.json({
          object: "account_state_diff",
          account_id: "acc_1",
          version: "v_next",
          changes: [],
        }),
      ),
    );
    const res = await client.webhooks.getStateDiff("acc_1");
    expect(res.object).toBe("account_state_diff");
    expect(res.account_id).toBe("acc_1");
  });

  it("forwards since_version query param", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/accounts/acc_1/state-diff`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "account_state_diff", account_id: "acc_1", version: "v2", changes: [] });
      }),
    );
    await client.webhooks.getStateDiff("acc_1", { since_version: "v1" });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("since_version")).toBe("v1");
  });
});

// ─── coverage: total public method count == 94 ───────────────────────────────
// (was 93: W2 added webhooks.get() — net-new GET /v1/webhooks/:id)
describe("coverage: total public method count == 94", () => {
  it("counts all public function properties across all resource namespaces (target: 94)", () => {
    const c = new Curviate({ apiKey: "k", baseUrl: BASE });

    function countMethods(obj: object): number {
      return Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
        .filter((name) => name !== "constructor" && typeof (obj as Record<string, unknown>)[name] === "function")
        .length;
    }

    // root-scoped namespaces
    const rootCount =
      countMethods(c.accounts) +     // 12
      countMethods(c.webhooks);      //  7 (was 6; +get)

    // account-scoped namespaces (get an instance via account())
    const scoped = c.account("acc_test");
    const scopedCount =
      countMethods(scoped.messaging) +       // 14
      countMethods(scoped.profiles) +        //  8 (getCompany removed, hard-moved to companies.get)
      countMethods(scoped.invites) +         //  5
      countMethods(scoped.search) +          //  5
      countMethods(scoped.posts) +           //  7
      countMethods(scoped.salesNavigator) +  // 12 (7 + 5-method v2 list-surface cascade)
      countMethods(scoped.recruiter) +       // 18
      countMethods(scoped.jobs) +            //  1
      countMethods(scoped.companies);        //  5

    const total = rootCount + scopedCount;
    expect(total).toBe(94);
  });
});
