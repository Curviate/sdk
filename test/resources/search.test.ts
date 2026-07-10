// search namespace (6 methods, account-scoped)
// Account-first path grammar. Pagination (offset/limit/cursor) stays a
// TOP-LEVEL query param on every structured op — never in the body.
// fromUrl is the sole home of URL-mode search: POST /v1/{account_id}/search
// body {url}.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_search", baseUrl: BASE });
const search = () => client.account("acc_se1").search;

describe("search.getParameters", () => {
  it("GET /v1/{account_id}/search/parameters forwards type/keywords/limit/offset", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_se1/search/parameters`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "search_parameter_list",
          items: [{ id: "id_1", name: "Software Development" }],
          cursor: null,
        });
      }),
    );
    const res = await search().getParameters({ type: "SKILL", keywords: "software development", limit: 5, offset: 0 });
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname).toBe("/v1/acc_se1/search/parameters");
    expect(params.get("type")).toBe("SKILL");
    expect(params.get("keywords")).toBe("software development");
    expect(params.get("limit")).toBe("5");
    expect(res.items[0]?.id).toBe("id_1");
  });
});

describe("search.people", () => {
  it("POST /v1/{account_id}/search/people — filters in the body, cursor/limit/offset in the query", async () => {
    let capturedUrl: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search/people`, async ({ request }) => {
        capturedUrl = request.url;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          object: "people_search_result",
          items: [],
          paging: { total_count: 0 },
          cursor: null,
        });
      }),
    );
    await search().people({ keywords: "engineer", cursor: "cur_1", limit: 10, offset: 20 });
    const parsed = new URL(capturedUrl!);
    expect(parsed.pathname).toBe("/v1/acc_se1/search/people");
    expect(parsed.searchParams.get("cursor")).toBe("cur_1");
    expect(parsed.searchParams.get("limit")).toBe("10");
    expect(parsed.searchParams.get("offset")).toBe("20");
    expect(body).toEqual({ keywords: "engineer" });
    expect(body).not.toHaveProperty("cursor");
    expect(body).not.toHaveProperty("limit");
    expect(body).not.toHaveProperty("offset");
    // structured search no longer accepts url in the body
    expect(body).not.toHaveProperty("url");
  });

  it("omitting cursor/limit/offset sends no query string", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search/people`, async ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "people_search_result", items: [], paging: { total_count: 0 }, cursor: null });
      }),
    );
    await search().people({ keywords: "engineer" });
    expect(new URL(capturedUrl!).search).toBe("");
  });
});

describe("search.companies", () => {
  it("POST /v1/{account_id}/search/companies", async () => {
    let capturedUrl: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search/companies`, async ({ request }) => {
        capturedUrl = request.url;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "company_search_result", items: [], paging: { total_count: 0 }, cursor: null });
      }),
    );
    await search().companies({ keywords: "acme", limit: 2 });
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_se1/search/companies");
    expect(new URL(capturedUrl!).searchParams.get("limit")).toBe("2");
    expect(body).toEqual({ keywords: "acme" });
  });
});

describe("search.posts", () => {
  it("POST /v1/{account_id}/search/posts", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search/posts`, async ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "post_search_result", items: [], paging: { total_count: 0 }, cursor: null });
      }),
    );
    await search().posts({ keywords: "hiring" });
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_se1/search/posts");
  });
});

describe("search.jobs", () => {
  it("POST /v1/{account_id}/search/jobs", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search/jobs`, async ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "job_search_result", items: [], paging: { total_count: 0 }, cursor: null });
      }),
    );
    await search().jobs({ keywords: "founders associate" });
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_se1/search/jobs");
  });
});

describe("search.fromUrl", () => {
  it("POST /v1/{account_id}/search sends {url} and NOTHING else", async () => {
    let capturedUrl: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search`, async ({ request }) => {
        capturedUrl = request.url;
        body = await request.json();
        return HttpResponse.json({ object: "search_result", items: [], cursor: null });
      }),
    );
    await search().fromUrl({ url: "https://www.linkedin.com/search/results/people/?keywords=engineer" });
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_se1/search");
    expect(body).toEqual({ url: "https://www.linkedin.com/search/results/people/?keywords=engineer" });
  });

  it("still supports cursor/limit/offset as query params alongside the url body", async () => {
    let capturedUrl: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_se1/search`, async ({ request }) => {
        capturedUrl = request.url;
        body = await request.json();
        return HttpResponse.json({ object: "search_result", items: [], cursor: null });
      }),
    );
    await search().fromUrl({ url: "https://www.linkedin.com/search/results/people/", cursor: "cur_9" });
    expect(new URL(capturedUrl!).searchParams.get("cursor")).toBe("cur_9");
    expect(body).toEqual({ url: "https://www.linkedin.com/search/results/people/" });
  });
});
