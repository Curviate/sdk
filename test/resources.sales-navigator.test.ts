// salesNavigator namespace (7 methods; tier: sn)
// TDD: MSW happy-path for every method + tier-gated error test.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";
import { CurviateError, isCurviateError } from "../src/errors.js";

const BASE = "https://app.curviate.test";
const ACC = "acc_sn1";
const client = new Curviate({ apiKey: "cvt_test_sn", baseUrl: BASE });
const sn = () => client.account(ACC).salesNavigator;

// ─── salesNavigator.searchPeople (POST /v1/sales-navigator/search/people) ─────
describe("salesNavigator.searchPeople", () => {
  it("POST /v1/sales-navigator/search/people returns result page", async () => {
    server.use(
      http.post(`${BASE}/v1/sales-navigator/search/people`, () =>
        HttpResponse.json(
          { object: "people_search_result_list", items: [], cursor: null },
          { status: 200 },
        ),
      ),
    );
    const res = await sn().searchPeople({ keywords: "Alice" });
    expect(res.object).toBe("people_search_result_list");
    expect(Array.isArray(res.items)).toBe(true);
  });

  // TIER_NOT_ACTIVE surfaces as CurviateError with required_tier.
  it("throws CurviateError with required_tier when TIER_NOT_ACTIVE", async () => {
    server.use(
      http.post(`${BASE}/v1/sales-navigator/search/people`, () =>
        HttpResponse.json(
          {
            code: "TIER_NOT_ACTIVE",
            message: "Sales Navigator add-on required.",
            required_tier: "sn",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 403 },
        ),
      ),
    );
    const err = await sn().searchPeople({}).catch((e: unknown) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("TIER_NOT_ACTIVE");
    expect((err as CurviateError).requiredTier).toBe("sn");
  });
});

// ─── salesNavigator.searchCompanies (POST /v1/sales-navigator/search/companies) ─
describe("salesNavigator.searchCompanies", () => {
  it("POST /v1/sales-navigator/search/companies returns result page", async () => {
    server.use(
      http.post(`${BASE}/v1/sales-navigator/search/companies`, () =>
        HttpResponse.json(
          { object: "company_search_result_list", items: [], cursor: null },
          { status: 200 },
        ),
      ),
    );
    const res = await sn().searchCompanies({ keywords: "Curviate" });
    expect(res.object).toBe("company_search_result_list");
  });
});

// ─── salesNavigator.getParameters (GET /v1/sales-navigator/search/parameters) ──
describe("salesNavigator.getParameters", () => {
  it("GET /v1/sales-navigator/search/parameters returns parameter list", async () => {
    server.use(
      http.get(`${BASE}/v1/sales-navigator/search/parameters`, () =>
        HttpResponse.json({ object: "search_parameter_list", items: [] }),
      ),
    );
    const res = await sn().getParameters({ account_id: ACC, type: "REGION" });
    expect(res.object).toBe("search_parameter_list");
  });
});

// ─── salesNavigator.startChat (POST /v1/sales-navigator/chats) multipart ──────
describe("salesNavigator.startChat", () => {
  it("POST /v1/sales-navigator/chats returns chat_started shape", async () => {
    server.use(
      http.post(`${BASE}/v1/sales-navigator/chats`, () =>
        HttpResponse.json(
          { object: "chat_started", chat_id: "snchat_1", message_id: "snmsg_1" },
          { status: 201 },
        ),
      ),
    );
    const res = await sn().startChat({
      account_id: ACC,
      attendees_ids: ["ACw_abc"],
      text: "Hello from SN",
    });
    expect(res.chat_id).toBe("snchat_1");
  });

  it("sends multipart/form-data when attachments provided", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/sales-navigator/chats`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json(
          { object: "chat_started", chat_id: "snchat_2", message_id: "snmsg_2" },
          { status: 201 },
        );
      }),
    );
    const buf = Buffer.from("attachment-data");
    await sn().startChat({
      account_id: ACC,
      attendees_ids: ["ACw_abc"],
      text: "With attachment",
      attachments: [buf],
    });
    // MSW normalises multipart — Content-Type starts with multipart/form-data
    expect(ct).toMatch(/^multipart\/form-data/);
  });
});

// ─── salesNavigator.getProfile (GET /v1/sales-navigator/profiles/:identifier) ──
describe("salesNavigator.getProfile", () => {
  it("GET /v1/sales-navigator/profiles/:identifier returns profile", async () => {
    server.use(
      http.get(`${BASE}/v1/sales-navigator/profiles/ACw_abc`, () =>
        HttpResponse.json({
          object: "profile",
          provider_id: "ACw_abc",
          first_name: "Alice",
          last_name: "Smith",
        }),
      ),
    );
    const res = await sn().getProfile("ACw_abc");
    expect(res.provider_id).toBe("ACw_abc");
  });
});

// ─── salesNavigator.saveLead (POST /v1/sales-navigator/leads/:user_id) ────────
describe("salesNavigator.saveLead", () => {
  it("POST /v1/sales-navigator/leads/:user_id saves the lead", async () => {
    server.use(
      http.post(`${BASE}/v1/sales-navigator/leads/ACw_abc`, () =>
        HttpResponse.json({ object: "lead_saved", user_id: "ACw_abc" }),
      ),
    );
    const res = await sn().saveLead("ACw_abc", { account_id: ACC });
    expect(res.user_id).toBe("ACw_abc");
  });
});

// ─── salesNavigator.syncMessages (GET /v1/sales-navigator/messages/sync) ──────
describe("salesNavigator.syncMessages", () => {
  it("GET /v1/sales-navigator/messages/sync returns sync status", async () => {
    server.use(
      http.get(`${BASE}/v1/sales-navigator/messages/sync`, () =>
        HttpResponse.json({ object: "account_sync", sync_status: "done" }),
      ),
    );
    const res = await sn().syncMessages({ account_id: ACC });
    expect(res.sync_status).toBe("done");
  });
});
