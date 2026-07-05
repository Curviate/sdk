// salesNavigator v2 list-surface cascade (5 net-new methods; tier: sn).
// TDD: mock-transport (MSW) assertions of method/path/query/body for
// accountLists / leadLists / browseAccountList / browseLeadList / saveAccount —
// mirroring the wire contract the server side already ships and tests.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const ACC = "acc_a";
const client = new Curviate({ apiKey: "cvt_test_sn_v2", baseUrl: BASE });
const sn = () => client.account(ACC).salesNavigator;

describe("salesNavigator.accountLists", () => {
  it("GET /v1/sales-navigator/account-lists?account_id=acc_a returns the account lists", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/sales-navigator/account-lists`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "sn_account_list_result",
          items: [{ object: "sn_account_list", id: "L1", name: "Targets", items_count: 3, last_modified_at: "2026-01-01T00:00:00Z" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await sn().accountLists({ account_id: ACC });
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname).toBe("/v1/sales-navigator/account-lists");
    expect(params.get("account_id")).toBe(ACC);
    expect(res.object).toBe("sn_account_list_result");
    expect(res.items).toHaveLength(1);
    expect(res.paging.total_count).toBe(1);
    expect(res.cursor).toBeNull();
  });
});

describe("salesNavigator.leadLists", () => {
  it("GET /v1/sales-navigator/lead-lists?account_id=acc_a returns the lead lists", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/sales-navigator/lead-lists`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "sn_lead_list_result",
          items: [{ object: "sn_lead_list", id: "L2", name: "Warm leads", items_count: 5, last_modified_at: "2026-01-01T00:00:00Z" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await sn().leadLists({ account_id: ACC });
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname).toBe("/v1/sales-navigator/lead-lists");
    expect(params.get("account_id")).toBe(ACC);
    expect(res.object).toBe("sn_lead_list_result");
  });
});

describe("salesNavigator.browseAccountList", () => {
  it("POST /v1/sales-navigator/account-lists/L1?account_id=acc_a with body { filter } browses the list", async () => {
    let url: string | undefined;
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/v1/sales-navigator/account-lists/L1`, async ({ request }) => {
        url = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({
          object: "sn_saved_account_result",
          items: [{ object: "sn_saved_account", id: "co_1", display_name: "T-Systems" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await sn().browseAccountList("L1", { filter: "STARRED" }, { account_id: ACC });
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname).toBe("/v1/sales-navigator/account-lists/L1");
    expect(params.get("account_id")).toBe(ACC);
    expect(capturedBody).toEqual({ filter: "STARRED" });
    expect(res.object).toBe("sn_saved_account_result");
  });
});

describe("salesNavigator.browseLeadList", () => {
  it("POST /v1/sales-navigator/lead-lists/L2?account_id=acc_a with body { spotlight } browses the list", async () => {
    let url: string | undefined;
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/v1/sales-navigator/lead-lists/L2`, async ({ request }) => {
        url = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({
          object: "sn_saved_lead_result",
          items: [{ object: "sn_saved_lead", id: "ACwABC", display_name: "Alice" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await sn().browseLeadList("L2", { spotlight: "RECENT_POSITION_CHANGE" }, { account_id: ACC });
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname).toBe("/v1/sales-navigator/lead-lists/L2");
    expect(params.get("account_id")).toBe(ACC);
    expect(capturedBody).toEqual({ spotlight: "RECENT_POSITION_CHANGE" });
    expect(res.object).toBe("sn_saved_lead_result");
  });
});

describe("salesNavigator.saveAccount", () => {
  it("POST /v1/sales-navigator/account-lists/L1/save with body { account_id, company_id } — account_id present in the body", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/v1/sales-navigator/account-lists/L1/save`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ object: "sn_account_saved", list_id: "L1", company_id: "123" });
      }),
    );
    const res = await sn().saveAccount({ list_id: "L1", company_id: "123", account_id: ACC });
    // The save endpoints carry no query params at all — account_id has nowhere
    // else to travel but the body.
    expect(capturedBody).toEqual({ account_id: ACC, company_id: "123" });
    expect(res.object).toBe("sn_account_saved");
    expect(res.list_id).toBe("L1");
    expect(res.company_id).toBe("123");
  });
});

describe("no vendor string in the SDK surface (grep gate)", () => {
  it("the sales-navigator resource source contains no substrate vendor name", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("../src/resources/sales-navigator.ts", import.meta.url), "utf8");
    const vendorName = ["uni", "pi", "le"].join("");
    expect(src.toLowerCase()).not.toContain(vendorName);
  });
});
