// accounts namespace methods.
// TDD: MSW happy-path for every method + explicit wire-path assertions for the
// account-id-in-path operations (checkpoint solve/request/poll, reconnect-link).
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
    await client.accounts.link({ seat_id: "s", auth_method: "cookie", cookie: { li_at: "x" }, user_agent: "UA" });
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

// ─── accounts.solveCheckpoint (POST /v1/accounts/{account_id}/checkpoint/solve) ─
describe("accounts.solveCheckpoint", () => {
  it("addresses the account in the PATH and sends {code} in the body", async () => {
    let seenPath: string | null = null;
    let body: unknown;
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/accounts/acc_prov/checkpoint/solve`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        ct = request.headers.get("content-type");
        body = await request.json();
        return HttpResponse.json({ object: "account", account_id: "acc_prov", status: "active" }, { status: 201 });
      }),
    );
    const res = await client.accounts.solveCheckpoint("acc_prov", { code: "123456" });
    // The account_id must interpolate into the path — not land in the body.
    expect(seenPath).toBe("/v1/accounts/acc_prov/checkpoint/solve");
    expect(ct).toContain("application/json");
    expect(body).toEqual({ code: "123456" });
    expect(res.object).toBe("account");
  });

  it("surfaces a chained challenge on 202", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/acc_prov/checkpoint/solve`, () =>
        HttpResponse.json(
          { object: "checkpoint", status: "checkpoint_required", account_id: "acc_prov", challenge_type: "two_factor_sms" },
          { status: 202 },
        ),
      ),
    );
    const res = await client.accounts.solveCheckpoint("acc_prov", { code: "111" });
    expect(res.object).toBe("checkpoint");
  });
});

// ─── accounts.requestCheckpoint (POST /v1/accounts/{account_id}/checkpoint/request) ─
describe("accounts.requestCheckpoint", () => {
  it("addresses the account in the PATH, sends no body, returns {resent}", async () => {
    let seenPath: string | null = null;
    let rawBody: string | null = null;
    server.use(
      http.post(`${BASE}/v1/accounts/acc_prov/checkpoint/request`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        rawBody = await request.text();
        return HttpResponse.json({ object: "checkpoint", account_id: "acc_prov", resent: true });
      }),
    );
    const res = await client.accounts.requestCheckpoint("acc_prov");
    expect(seenPath).toBe("/v1/accounts/acc_prov/checkpoint/request");
    // Bodyless POST: no JSON body on the wire.
    expect(rawBody).toBe("");
    expect(res.object).toBe("checkpoint");
    expect(res.resent).toBe(true);
  });

  it("honest no-op: returns resent:false without throwing (nothing to re-send for this challenge type)", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/acc_prov/checkpoint/request`, () =>
        HttpResponse.json({ object: "checkpoint", account_id: "acc_prov", resent: false }),
      ),
    );
    const res = await client.accounts.requestCheckpoint("acc_prov");
    expect(res.resent).toBe(false);
  });
});

// ─── accounts.pollCheckpoint (POST /v1/accounts/{account_id}/checkpoint/poll) ─
describe("accounts.pollCheckpoint", () => {
  it("addresses the account in the PATH, sends no body, returns status", async () => {
    let seenPath: string | null = null;
    let rawBody: string | null = null;
    server.use(
      http.post(`${BASE}/v1/accounts/acc_prov/checkpoint/poll`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        rawBody = await request.text();
        return HttpResponse.json({ object: "checkpoint", status: "pending", account_id: "acc_prov" });
      }),
    );
    const res = await client.accounts.pollCheckpoint("acc_prov");
    expect(seenPath).toBe("/v1/accounts/acc_prov/checkpoint/poll");
    expect(rawBody).toBe("");
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

  it("carries the session_id poll handle on the 201", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/connect-link`, () =>
        HttpResponse.json(
          { object: "hosted_auth_url", url: "https://connect.curviate.com/abc", session_id: "cs_1", expires_at: "2026-06-21T13:00:00Z", seat_id: "seat_1" },
          { status: 201 },
        ),
      ),
    );
    const res = await client.accounts.createConnectLink({ seat_id: "seat_1" });
    expect(res.session_id).toBe("cs_1");
  });
});

// ─── accounts.createReconnectLink (POST /v1/accounts/{account_id}/reconnect-link) ─
describe("accounts.createReconnectLink", () => {
  it("addresses the account in the PATH and returns a hosted re-auth session", async () => {
    let seenPath: string | null = null;
    server.use(
      http.post(`${BASE}/v1/accounts/acc_1/reconnect-link`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json(
          { object: "hosted_auth_url", url: "https://connect.curviate.com/re", session_id: "cs_re", expires_at: "2026-06-21T13:00:00Z", account_id: "acc_1" },
          { status: 201 },
        );
      }),
    );
    const res = await client.accounts.createReconnectLink("acc_1");
    expect(seenPath).toBe("/v1/accounts/acc_1/reconnect-link");
    expect(res.object).toBe("hosted_auth_url");
    expect(res.session_id).toBe("cs_re");
    expect(res.account_id).toBe("acc_1");
  });

  it("forwards optional body fields (expires_in_seconds, redirect_url)", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/accounts/acc_1/reconnect-link`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { object: "hosted_auth_url", url: "https://connect.curviate.com/re", session_id: "cs_re", expires_at: "2026-06-21T13:00:00Z", account_id: "acc_1" },
          { status: 201 },
        );
      }),
    );
    await client.accounts.createReconnectLink("acc_1", { expires_in_seconds: 600, redirect_url: "https://app.example.com/done" });
    expect(body).toEqual({ expires_in_seconds: 600, redirect_url: "https://app.example.com/done" });
  });
});

// ─── accounts.getConnectSession (GET /v1/accounts/connect-sessions/:id) ──────
describe("accounts.getConnectSession", () => {
  it("GET /v1/accounts/connect-sessions/:session_id returns pending status", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts/connect-sessions/cs_1`, () =>
        HttpResponse.json({ object: "connect_session", session_id: "cs_1", status: "pending", account_id: null, expires_at: "2026-06-21T13:00:00Z" }),
      ),
    );
    const res = await client.accounts.getConnectSession("cs_1");
    expect(res.object).toBe("connect_session");
    expect(res.status).toBe("pending");
    expect(res.account_id).toBeNull();
  });

  it("carries account_id once the session is resolved", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts/connect-sessions/cs_1`, () =>
        HttpResponse.json({ object: "connect_session", session_id: "cs_1", status: "resolved", account_id: "acc_9", expires_at: "2026-06-21T13:00:00Z" }),
      ),
    );
    const res = await client.accounts.getConnectSession("cs_1");
    expect(res.status).toBe("resolved");
    expect(res.account_id).toBe("acc_9");
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
  it("POST /v1/accounts/:account_id/reconnect returns account on 200", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/acc_1/reconnect`, () =>
        HttpResponse.json({ object: "account", account_id: "acc_1", status: "active" }),
      ),
    );
    const res = await client.accounts.reconnect("acc_1", {
      auth_method: "cookie",
      cookie: { li_at: "y" },
      user_agent: "UA",
    });
    expect(res.account_id).toBe("acc_1");
  });

  it("surfaces a checkpoint challenge on 202 (same as link)", async () => {
    server.use(
      http.post(`${BASE}/v1/accounts/acc_1/reconnect`, () =>
        HttpResponse.json(
          { object: "checkpoint", status: "checkpoint_required", account_id: "acc_1", challenge_type: "otp" },
          { status: 202 },
        ),
      ),
    );
    const res = await client.accounts.reconnect("acc_1", { auth_method: "cookie", cookie: { li_at: "y" }, user_agent: "UA" });
    expect(res.object).toBe("checkpoint");
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
