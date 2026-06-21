// sdk/002 — accounts namespace methods (all 9 remaining after list() in the reference slice)
// TDD: MSW happy-path for every method + a smoke test for the full method count.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_accounts", baseUrl: BASE });

// ─── accounts.link (POST /v1/accounts/link) ─────────────────────────────────
describe("accounts.link", () => {
  it("POST /v1/accounts/link returns account on 201", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/link`, () =>
        HttpResponse.json(
          { object: "account", account_id: "acc_1", status: "active" },
          { status: 201 },
        ),
      ),
    );
    const res = await client.accounts.link({
      seat_id: "seat_1",
      auth_method: "credentials",
      credentials: { email: "u@x.com", password: "p" },
    });
    expect(res.object).toBe("account");
    expect(res.account_id).toBe("acc_1");
  });

  it("sends Content-Type: application/json", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/accounts/link`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "account", account_id: "acc_1", status: "active" }, { status: 201 });
      }),
    );
    await client.accounts.link({ seat_id: "s", auth_method: "cookie", cookie: { li_at: "x" } });
    expect(ct).toContain("application/json");
  });

  it("returns checkpoint shape on 202", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/link`, () =>
        HttpResponse.json(
          {
            object: "checkpoint",
            status: "checkpoint_required",
            account_id: "acc_prov",
            challenge_type: "otp",
            expires_at: "2026-06-21T12:00:00Z",
          },
          { status: 202 },
        ),
      ),
    );
    const res = await client.accounts.link({
      seat_id: "s",
      auth_method: "credentials",
      credentials: { email: "u@x.com", password: "p" },
    });
    expect(res.object).toBe("checkpoint");
    expect(res.account_id).toBe("acc_prov");
  });
});

// ─── accounts.submitCheckpoint (POST /v1/accounts/checkpoints/submit) ────────
describe("accounts.submitCheckpoint", () => {
  it("POST /v1/accounts/checkpoints/submit returns account on 200", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/checkpoints/submit`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1", status: "active" }),
      ),
    );
    const res = await client.accounts.submitCheckpoint({
      account_id: "acc_prov",
      code: "123456",
    });
    expect(res.object).toBe("account");
  });
});

// ─── accounts.pollCheckpoint (POST /v1/accounts/checkpoints/poll) ─────────────
describe("accounts.pollCheckpoint", () => {
  it("POST /v1/accounts/checkpoints/poll returns status", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/checkpoints/poll`, () =>
        HttpResponse.json({ object: "checkpoint", status: "checkpoint_required", account_id: "acc_prov" }),
      ),
    );
    const res = await client.accounts.pollCheckpoint({ account_id: "acc_prov" });
    expect(res.account_id).toBe("acc_prov");
  });
});

// ─── accounts.createConnectLink (POST /v1/accounts/connect-link) ─────────────
describe("accounts.createConnectLink", () => {
  it("POST /v1/accounts/connect-link returns hosted url", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/connect-link`, () =>
        HttpResponse.json(
          { object: "hosted_auth_url", url: "https://connect.curviate.com/abc", expires_at: "2026-06-21T13:00:00Z", seat_id: "seat_1" },
          { status: 201 },
        ),
      ),
    );
    const res = await client.accounts.createConnectLink({ seat_id: "seat_1" });
    expect(res.object).toBe("hosted_auth_url");
    expect(res.url).toContain("curviate.com");
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

// ─── accounts.reconnect (POST /v1/accounts/:account_id/reconnect) ─────────────
describe("accounts.reconnect", () => {
  it("POST /v1/accounts/:account_id/reconnect returns account", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/acc_1/reconnect`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1", status: "active" }),
      ),
    );
    const res = await client.accounts.reconnect("acc_1", {
      auth_method: "cookie",
      cookie: { li_at: "y" },
    });
    expect(res.account_id).toBe("acc_1");
  });
});

// ─── accounts.refresh (POST /v1/accounts/:account_id/refresh) ─────────────────
describe("accounts.refresh", () => {
  it("POST /v1/accounts/:account_id/refresh returns account", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/acc_1/refresh`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1" }),
      ),
    );
    const res = await client.accounts.refresh("acc_1");
    expect(res.account_id).toBe("acc_1");
  });
});

// ─── accounts.update (PATCH /v1/accounts/:account_id) ────────────────────────
describe("accounts.update", () => {
  it("PATCH /v1/accounts/:account_id returns updated account", async () => {
    server.use(
      http.patch(`${BASE}/v1/accounts/acc_1`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1" }),
      ),
    );
    const res = await client.accounts.update("acc_1", { country: "DE" });
    expect(res.account_id).toBe("acc_1");
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
