// salesNavigator namespace (12 methods, account-scoped, tier: sn) — path
// realign to the account-first grammar; the v2 list surface's bodies shrink
// to just their own field now that account_id lives in the path
// (saveAccount -> {company_id}, saveLead -> {user_id}). startChat drops
// multipart entirely — the served surface has zero multipart ops. New:
// searchFromUrl. Removed: syncMessages (no served equivalent).
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_sn", baseUrl: BASE });
const acc = client.account("acc_1");

describe("salesNavigator.searchPeople", () => {
  it("POST /v1/{account_id}/sales-navigator/search/people", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/search/people`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "sn_people_search_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.searchPeople({ keywords: "founder" });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/search/people");
    expect(body).toEqual({ keywords: "founder" });
    expect(res.object).toBe("sn_people_search_result");
  });

  it("forwards limit/cursor as query params, never in the body", async () => {
    let url: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/search/people`, async ({ request }) => {
        url = request.url;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "sn_people_search_result", items: [], cursor: null });
      }),
    );
    await acc.salesNavigator.searchPeople({ keywords: "founder" }, { limit: 10, cursor: "cur_1" });
    const params = new URL(url!).searchParams;
    expect(params.get("limit")).toBe("10");
    expect(params.get("cursor")).toBe("cur_1");
    expect(body).not.toHaveProperty("limit");
    expect(body).not.toHaveProperty("cursor");
  });
});

describe("salesNavigator.searchCompanies", () => {
  it("POST /v1/{account_id}/sales-navigator/search/companies", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/search/companies`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "sn_company_search_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.searchCompanies({ keywords: "acme" });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/search/companies");
    expect(body).toEqual({ keywords: "acme" });
    expect(res.object).toBe("sn_company_search_result");
  });
});

describe("salesNavigator.getParameters", () => {
  it("GET /v1/{account_id}/sales-navigator/search/parameters", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/sales-navigator/search/parameters`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "sn_search_parameter_list", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.getParameters({ type: "INDUSTRY" });
    const url = new URL(capturedUrl!);
    expect(url.pathname).toBe("/v1/acc_1/sales-navigator/search/parameters");
    expect(url.searchParams.get("type")).toBe("INDUSTRY");
    expect(res.object).toBe("sn_search_parameter_list");
  });
});

describe("salesNavigator.startChat", () => {
  it("POST /v1/{account_id}/sales-navigator/chats sends application/json — never multipart", async () => {
    let ct: string | null = null;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/chats`, async ({ request }) => {
        ct = request.headers.get("content-type");
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "chat_started", chat_id: "sn_chat_1", message_id: "msg_1" }, { status: 201 });
      }),
    );
    const res = await acc.salesNavigator.startChat({
      attendees_ids: ["ACw_sn_1"],
      text: "Hi there",
      subject: "Intro",
    });
    expect(ct).toMatch(/^application\/json/);
    expect(body).toEqual({ attendees_ids: ["ACw_sn_1"], text: "Hi there", subject: "Intro" });
    expect(res.chat_id).toBe("sn_chat_1");
  });

  it("sends base64 attachment objects, not FormData", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/chats`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "chat_started", chat_id: "sn_chat_1", message_id: "msg_1" }, { status: 201 });
      }),
    );
    await acc.salesNavigator.startChat({
      attendees_ids: ["ACw_sn_1"],
      text: "Sharing a file",
      subject: "Follow-up",
      attachments: [{ content: "aGVsbG8=", content_type: "text/plain", filename: "note.txt" }],
    });
    expect(body?.attachments).toEqual([{ content: "aGVsbG8=", content_type: "text/plain", filename: "note.txt" }]);
  });
});

describe("salesNavigator.getProfile", () => {
  it("GET /v1/{account_id}/sales-navigator/profiles/{identifier}", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/sales-navigator/profiles/ACw_1`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "profile", id: "ACw_1", type: "individual", display_name: "Alice", provider: "linkedin", specifics: {} });
      }),
    );
    const res = await acc.salesNavigator.getProfile("ACw_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/sales-navigator/profiles/ACw_1");
    expect(res.id).toBe("ACw_1");
  });
});

describe("salesNavigator.accountLists", () => {
  it("GET /v1/{account_id}/sales-navigator/account-lists", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/sales-navigator/account-lists`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "sn_account_list_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.accountLists();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/sales-navigator/account-lists");
    expect(res.object).toBe("sn_account_list_result");
  });
});

describe("salesNavigator.leadLists", () => {
  it("GET /v1/{account_id}/sales-navigator/lead-lists", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/sales-navigator/lead-lists`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "sn_lead_list_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.leadLists();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/sales-navigator/lead-lists");
    expect(res.object).toBe("sn_lead_list_result");
  });
});

describe("salesNavigator.browseAccountList", () => {
  it("POST /v1/{account_id}/sales-navigator/account-lists/{list_id}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/account-lists/list_1`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "sn_saved_account_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.browseAccountList("list_1", { persona: "p_1" });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/account-lists/list_1");
    expect(body).toEqual({ persona: "p_1" });
    expect(res.object).toBe("sn_saved_account_result");
  });

  it("sends {} when no body filters are supplied", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/account-lists/list_1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ object: "sn_saved_account_result", items: [], cursor: null });
      }),
    );
    await acc.salesNavigator.browseAccountList("list_1");
    expect(body).toEqual({});
  });
});

describe("salesNavigator.browseLeadList", () => {
  it("POST /v1/{account_id}/sales-navigator/lead-lists/{list_id}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/lead-lists/list_2`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "sn_saved_lead_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.browseLeadList("list_2", { spotlight: "RECENT_POSITION_CHANGE" });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/lead-lists/list_2");
    expect(body).toEqual({ spotlight: "RECENT_POSITION_CHANGE" });
    expect(res.object).toBe("sn_saved_lead_result");
  });
});

describe("salesNavigator.saveAccount", () => {
  it("POST /v1/{account_id}/sales-navigator/account-lists/{list_id}/save sends only {company_id}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/account-lists/list_1/save`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "sn_account_saved" });
      }),
    );
    const res = await acc.salesNavigator.saveAccount({ list_id: "list_1", company_id: "co_1" });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/account-lists/list_1/save");
    expect(body).toEqual({ company_id: "co_1" });
    expect((body as Record<string, unknown>)["account_id"]).toBeUndefined();
    expect(res.object).toBe("sn_account_saved");
  });
});

describe("salesNavigator.saveLead", () => {
  it("POST /v1/{account_id}/sales-navigator/lead-lists/{list_id}/save sends only {user_id}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/lead-lists/list_2/save`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "sn_lead_saved" });
      }),
    );
    const res = await acc.salesNavigator.saveLead({ list_id: "list_2", user_id: "ACw_1" });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/lead-lists/list_2/save");
    expect(body).toEqual({ user_id: "ACw_1" });
    expect((body as Record<string, unknown>)["account_id"]).toBeUndefined();
    expect(res.object).toBe("sn_lead_saved");
  });
});

describe("salesNavigator.searchFromUrl", () => {
  it("POST /v1/{account_id}/sales-navigator/search sends {url}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/sales-navigator/search`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "sn_search_result", items: [], cursor: null });
      }),
    );
    const res = await acc.salesNavigator.searchFromUrl({
      url: "https://www.linkedin.com/sales/search/people?query=x",
    });
    expect(seenPath).toBe("/v1/acc_1/sales-navigator/search");
    expect(body).toEqual({ url: "https://www.linkedin.com/sales/search/people?query=x" });
    expect(res.object).toBe("sn_search_result");
  });
});

describe("salesNavigator.syncMessages removal (no served op)", () => {
  it("stays absent from the salesNavigator resource surface", () => {
    expect((acc.salesNavigator as unknown as Record<string, unknown>)["syncMessages"]).toBeUndefined();
  });
});
