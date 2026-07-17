// profile namespace (4 methods, account-scoped, NEW namespace) — the
// connected account's own insight surface: premium subscription, performance
// analytics, recent profile viewers, and Social Selling Index. All four are
// self-reads; `visitors` is the only cursor-paginated list. The namespace is
// account-scoped ONLY — reachable via client.account(id).profile, never the
// root client.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";
import { CurviateError, isCurviateError } from "../../src/errors.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_profile", baseUrl: BASE });
const acc = client.account("acc_1");

describe("profile.subscription", () => {
  it("GET /v1/{account_id}/profile/subscription — account-first path", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/subscription`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "profile_subscription",
          has_premium: true,
          plan_title: "Premium Business",
          description: null,
          manage_url: null,
          cancel_url: null,
          switch_url: null,
          subscriptions: [{ object: "subscription", title: "Premium Business" }],
          actions: {},
        });
      }),
    );
    const res = await acc.profile.subscription();
    expect(capturedPath).toBe("/v1/acc_1/profile/subscription");
    expect(res.object).toBe("profile_subscription");
    expect(res.has_premium).toBe(true);
    expect(res.plan_title).toBe("Premium Business");
  });

  it("a free account is a valid 200 empty state (has_premium:false)", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/subscription`, () =>
        HttpResponse.json({
          object: "profile_subscription",
          has_premium: false,
          plan_title: null,
          description: null,
          manage_url: null,
          cancel_url: null,
          switch_url: null,
          subscriptions: [],
          actions: {},
        }),
      ),
    );
    const res = await acc.profile.subscription();
    expect(res.has_premium).toBe(false);
    expect(res.subscriptions).toEqual([]);
  });
});

describe("profile.analytics", () => {
  it("GET /v1/{account_id}/profile/analytics — headline metrics", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/analytics`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "profile_analytics",
          profile_viewers: { count: 128, label: "Profile viewers" },
          followers: { count: 3400, label: "Followers" },
          post_impressions: { count: 9800, label: "Post impressions" },
          search_appearances: { count: 42, label: "Search appearances" },
        });
      }),
    );
    const res = await acc.profile.analytics();
    expect(capturedPath).toBe("/v1/acc_1/profile/analytics");
    expect(res.object).toBe("profile_analytics");
    expect(res.profile_viewers.count).toBe(128);
  });
});

describe("profile.visitors", () => {
  it("GET /v1/{account_id}/profile/visitors — cursor-paginated list", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/visitors`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "profile_visitor_list",
          items: [{ object: "profile_visitor", kind: "identified", name: "Dana Lee" }],
          cursor: "cur_next",
        });
      }),
    );
    const res = await acc.profile.visitors();
    expect(capturedPath).toBe("/v1/acc_1/profile/visitors");
    expect(res.object).toBe("profile_visitor_list");
    expect(res.cursor).toBe("cur_next");
    expect(res.items?.length).toBe(1);
  });

  it("forwards limit/cursor query params", async () => {
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/visitors`, ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ object: "profile_visitor_list", items: [], cursor: null });
      }),
    );
    await acc.profile.visitors({ limit: 50, cursor: "cur_1" });
    expect(search?.get("limit")).toBe("50");
    expect(search?.get("cursor")).toBe("cur_1");
  });
});

describe("profile.ssi", () => {
  it("GET /v1/{account_id}/profile/ssi — score + pillars", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/ssi`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "profile_ssi",
          overall: 72.4,
          pillars: {
            professional_brand: 20.1,
            find_right_people: 18.0,
            insight_engagement: 16.3,
            strong_relationship: 18.0,
          },
          industry_rank_pct: 12,
          network_rank_pct: 8,
          industry: "Software",
          active_seat: true,
          calculated_at: 1720000000000,
        });
      }),
    );
    const res = await acc.profile.ssi();
    expect(capturedPath).toBe("/v1/acc_1/profile/ssi");
    expect(res.object).toBe("profile_ssi");
    expect(res.overall).toBe(72.4);
  });
});

describe("profile error envelope", () => {
  it("a foreign account_id surfaces the server's 404 as CurviateError(ACCOUNT_NOT_FOUND)", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/subscription`, () =>
        HttpResponse.json(
          {
            code: "ACCOUNT_NOT_FOUND",
            message: "No connected account with id acc_1.",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 404 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await acc.profile.subscription();
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("ACCOUNT_NOT_FOUND");
    expect((caught as CurviateError).httpStatus).toBe(404);
  });
});

describe("profile namespace mounting", () => {
  it("is account-scoped only — mounted on account(id), never the root client", () => {
    expect(acc).toHaveProperty("profile");
    expect(client).not.toHaveProperty("profile");
  });
});
