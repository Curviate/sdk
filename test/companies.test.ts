// companies namespace (5 methods, account-scoped)
// TDD: get() by handle-or-numeric-id, the four sub-resource facades' query
// forwarding, and the removal of profiles.getCompany (hard-move).
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";
import { CurviateError, isCurviateError } from "../src/errors.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_companies", baseUrl: BASE });
const companies = () => client.account("acc_co1").companies;

const COMPANY_PROFILE_FIXTURE = {
  object: "company_profile",
  id: "112013061",
  name: "T-Systems",
  description: "A global leader in innovative solutions.",
  entity_urn: "urn:li:organization:112013061",
  public_identifier: "t-systems",
  profile_url: "https://www.linkedin.com/company/t-systems",
  hashtags: [],
  messaging: { is_enabled: true, id: "msg_1", entity_urn: "urn:li:organization:112013061" },
  claimed: true,
  viewer_permissions: { canReadMessages: true },
  organization_type: "PUBLIC_COMPANY",
  locations: [{ is_headquarter: true, country: "DE", city: "Bonn" }],
};

describe("companies.get", () => {
  it("GET /v1/companies/:identifier — a public handle issues the request as-is", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/companies/t-systems`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(COMPANY_PROFILE_FIXTURE);
      }),
    );
    const res = await companies().get("t-systems");
    expect(capturedUrl).toBeDefined();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/companies/t-systems");
    expect(res.object).toBe("company_profile");
    expect(res.id).toBe("112013061");
    expect(res.name).toBe("T-Systems");
  });

  it("GET /v1/companies/:identifier — a numeric id issues the identical request shape", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/companies/112013061`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(COMPANY_PROFILE_FIXTURE);
      }),
    );
    const res = await companies().get("112013061");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/companies/112013061");
    expect(res.id).toBe("112013061");
  });

  it("account(id) injects account_id as a query param", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/companies/t-systems`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(COMPANY_PROFILE_FIXTURE);
      }),
    );
    await companies().get("t-systems");
    expect(new URL(url!).searchParams.get("account_id")).toBe("acc_co1");
  });
});

describe("companies.employees", () => {
  it("GET /v1/companies/:identifier/employees forwards keywords/location/limit as query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/companies/112013061/employees`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "company_employee_list",
          items: [{ id: "ACoA1", public_identifier: "frank", full_name: "Frank Employee" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await companies().employees("112013061", {
      keywords: "engineer",
      location: "reg_1",
      limit: 5,
    });
    const params = new URL(url!).searchParams;
    expect(params.get("keywords")).toBe("engineer");
    expect(params.get("location")).toBe("reg_1");
    expect(params.get("limit")).toBe("5");
    expect(res.object).toBe("company_employee_list");
    expect(res.items).toHaveLength(1);
    expect(res.paging.total_count).toBe(1);
    expect(res.cursor).toBeNull();
  });

  it("omitting params issues a bare request (no stray query keys)", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/companies/112013061/employees`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "company_employee_list", items: [], paging: { total_count: 0 }, cursor: null });
      }),
    );
    await companies().employees("112013061");
    const params = new URL(url!).searchParams;
    expect(params.has("keywords")).toBe(false);
    expect(params.has("location")).toBe(false);
  });
});

describe("companies.posts", () => {
  it("GET /v1/companies/:identifier/posts returns the post list with content verbatim", async () => {
    server.use(
      http.get(`${BASE}/v1/companies/112013061/posts`, () =>
        HttpResponse.json({
          object: "company_post_list",
          items: [{ post_urn: "urn:li:activity:1", text: "We are hiring!" }],
          paging: { total_count: 1 },
          cursor: "cur_1",
        }),
      ),
    );
    const res = await companies().posts("112013061", { limit: 3 });
    expect(res.object).toBe("company_post_list");
    expect(res.items[0]?.text).toBe("We are hiring!");
    expect(res.paging.total_count).toBe(1);
    expect(res.cursor).toBe("cur_1");
  });
});

describe("companies.jobs", () => {
  it("GET /v1/companies/:identifier/jobs returns job items and forwards keywords", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/companies/112013061/jobs`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "company_job_list",
          items: [{ job_urn: "urn:li:job:1", title: "Founders Associate" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await companies().jobs("112013061", { keywords: "founder" });
    expect(new URL(url!).searchParams.get("keywords")).toBe("founder");
    expect(res.object).toBe("company_job_list");
    expect(res.items[0]?.job_urn).toBe("urn:li:job:1");
  });

  it("a valid-empty result (no open postings) is not treated as an error", async () => {
    server.use(
      http.get(`${BASE}/v1/companies/112013061/jobs`, () =>
        HttpResponse.json({ object: "company_job_list", items: [], paging: { total_count: 0 }, cursor: null }),
      ),
    );
    const res = await companies().jobs("112013061");
    expect(res.items).toEqual([]);
    expect(res.paging.total_count).toBe(0);
  });
});

describe("companies.followers", () => {
  it("GET /v1/companies/:identifier/followers returns follower items with no paging block", async () => {
    server.use(
      http.get(`${BASE}/v1/companies/112013061/followers`, () =>
        HttpResponse.json({
          object: "company_follower_list",
          items: [{ object: "follower", id: "ACoAFOL1", urn: "urn:li:member:1", name: "Diana Follower", headline: "Engineer", profile_url: "https://www.linkedin.com/in/diana" }],
          cursor: null,
        }),
      ),
    );
    const res = await companies().followers("112013061", { limit: 10 });
    expect(res.object).toBe("company_follower_list");
    expect(res.items[0]?.name).toBe("Diana Follower");
    expect((res as Record<string, unknown>).paging).toBeUndefined();
  });

  it("wrong usage: a non-numeric identifier is forwarded as-is and the server's 400 surfaces as CurviateError", async () => {
    server.use(
      http.get(`${BASE}/v1/companies/anthropic/followers`, () =>
        HttpResponse.json(
          {
            code: "INVALID_REQUEST",
            message: "identifier must be numeric.",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 400 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await companies().followers("anthropic");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
  });
});

describe("profiles.getCompany removal (hard-move)", () => {
  it("is absent from the profiles resource surface", () => {
    const acc = client.account("acc_co1");
    expect((acc.profiles as unknown as Record<string, unknown>)["getCompany"]).toBeUndefined();
  });
});
