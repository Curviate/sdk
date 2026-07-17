// companies namespace (13 methods, account-scoped)
// Account-first path grammar: account_id is the leading /v1/ path segment,
// never a query param (fixes the pre-existing companies.get query-param
// injection failure). `managed`/`followers`/`invitableFollowers` are the
// company-insights trio; `followers` is re-added under a different item
// shape than the pre-0.15.0 method of the same name. `followInvite` (spec
// api/028) sends the follow-invitation invitableFollowers() seeds — partial-
// success per-invitee results, in request order. `chats`/`chat`/`messages`/
// `message`/`searchChats` are the Beta company-inbox surface.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";
import { CurviateError, isCurviateError } from "../../src/errors.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_companies", baseUrl: BASE });
const companies = () => client.account("acc_co1").companies;

const COMPANY_PROFILE_FIXTURE = {
  object: "company_profile",
  id: "112013061",
  name: "T-Systems",
  description: "A global leader in innovative solutions.",
  public_identifier: "t-systems",
  profile_url: "https://www.linkedin.com/company/t-systems",
  hashtags: [],
  is_active: true,
  is_archived: false,
  is_verified: true,
  locations: [{ is_headquarter: true, country_code: "DE", city: "Bonn" }],
};

describe("companies.get", () => {
  it("GET /v1/{account_id}/companies/{identifier} — a public handle issues the request as-is", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/t-systems`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(COMPANY_PROFILE_FIXTURE);
      }),
    );
    const res = await companies().get("t-systems");
    expect(capturedUrl).toBeDefined();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_co1/companies/t-systems");
    expect(res.object).toBe("company_profile");
    expect(res.id).toBe("112013061");
    expect(res.name).toBe("T-Systems");
  });

  it("GET /v1/{account_id}/companies/{identifier} — a numeric id issues the identical request shape", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(COMPANY_PROFILE_FIXTURE);
      }),
    );
    const res = await companies().get("112013061");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_co1/companies/112013061");
    expect(res.id).toBe("112013061");
  });

  it("account_id is the leading path segment, never a query param", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/t-systems`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(COMPANY_PROFILE_FIXTURE);
      }),
    );
    await companies().get("t-systems");
    const parsed = new URL(url!);
    expect(parsed.pathname.startsWith("/v1/acc_co1/")).toBe(true);
    expect(parsed.searchParams.has("account_id")).toBe(false);
  });
});

describe("companies.employees", () => {
  it("GET /v1/{account_id}/companies/{identifier}/employees forwards keywords/location/limit as query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/employees`, ({ request }) => {
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
      http.get(`${BASE}/v1/acc_co1/companies/112013061/employees`, ({ request }) => {
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
  it("GET /v1/{account_id}/companies/{identifier}/posts returns the post list with content verbatim", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/posts`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "company_post_list",
          items: [{ id: "urn:li:activity:1", text: "We are hiring!" }],
          cursor: "cur_1",
        });
      }),
    );
    const res = await companies().posts("112013061", { limit: 3 });
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_co1/companies/112013061/posts");
    expect(res.object).toBe("company_post_list");
    expect(res.items[0]?.text).toBe("We are hiring!");
    expect(res.cursor).toBe("cur_1");
  });
});

describe("companies.jobs", () => {
  it("GET /v1/{account_id}/companies/{identifier}/jobs returns job items and forwards keywords", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/jobs`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "company_job_list",
          items: [{ job_urn: "urn:li:job:1", title: "Founders Associate" }],
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
      http.get(`${BASE}/v1/acc_co1/companies/112013061/jobs`, () =>
        HttpResponse.json({ object: "company_job_list", items: [], cursor: null }),
      ),
    );
    const res = await companies().jobs("112013061");
    expect(res.items).toEqual([]);
  });

  it("wrong usage: a non-numeric identifier is forwarded as-is and the server's 400 surfaces as CurviateError", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/anthropic/jobs`, () =>
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
      await companies().jobs("anthropic");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
  });
});

describe("companies.managed", () => {
  it("GET /v1/{account_id}/companies/managed lists administered pages", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/managed`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "managed_company_list",
          items: [
            {
              object: "managed_company",
              type: "organization",
              id: "112013061",
              is_admin: true,
              can_invite_to_follow: true,
              capabilities: ["canCreateOrganicShare"],
              permissions: { update_profile: true, create_share: true, manage_admins: true, read_analytics: true },
            },
          ],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await companies().managed({ limit: 10 });
    expect(new URL(url!).pathname).toBe("/v1/acc_co1/companies/managed");
    expect(new URL(url!).searchParams.get("limit")).toBe("10");
    expect(res.object).toBe("managed_company_list");
    expect(res.items[0]?.id).toBe("112013061");
  });

  it("an empty administered set is a valid, non-error result", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/managed`, () =>
        HttpResponse.json({ object: "managed_company_list", items: [], paging: { total_count: 0 }, cursor: null }),
      ),
    );
    const res = await companies().managed();
    expect(res.items).toEqual([]);
  });
});

describe("companies.followers", () => {
  it("GET /v1/{account_id}/companies/{identifier}/followers is present again — company_follower item shape", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/followers`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "company_follower_list",
          items: [
            {
              object: "company_follower",
              id: "ACoAAExampleFollower0001",
              name: "Dana Ellison",
              headline: "VP of Engineering",
              degree: "2nd",
              followed_at: "June 2026",
            },
          ],
          cursor: null,
        });
      }),
    );
    const res = await companies().followers("112013061", { limit: 10 });
    expect(new URL(url!).pathname).toBe("/v1/acc_co1/companies/112013061/followers");
    expect(new URL(url!).searchParams.get("limit")).toBe("10");
    expect(res.object).toBe("company_follower_list");
    expect(res.items[0]?.degree).toBe("2nd");
  });
});

describe("companies.invitableFollowers", () => {
  it("GET /v1/{account_id}/companies/{identifier}/invitable-followers lists invitable connections", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/invitable-followers`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "invitable_connection_list",
          items: [
            { object: "invitable_connection", id: "ACoAAExampleInvitee0001", profile_urn: "urn:li:fsd_profile:ACoAAExampleInvitee0001" },
          ],
          cursor: null,
        });
      }),
    );
    const res = await companies().invitableFollowers("112013061");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_co1/companies/112013061/invitable-followers");
    expect(res.object).toBe("invitable_connection_list");
    expect(res.items[0]?.id).toBe("ACoAAExampleInvitee0001");
  });

  it("nobody invitable is a valid, non-error empty result", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/invitable-followers`, () =>
        HttpResponse.json({ object: "invitable_connection_list", items: [], cursor: null }),
      ),
    );
    const res = await companies().invitableFollowers("112013061");
    expect(res.items).toEqual([]);
  });
});

describe("companies.followInvite", () => {
  it("POST /v1/{account_id}/companies/{identifier}/follow-invite sends {invitee_ids}, fresh-create result", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_co1/companies/112013061/follow-invite`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          object: "company_follow_invite_result",
          results: [
            {
              object: "company_follow_invite",
              invitee_id: "ACoAAExampleInvitee0001",
              status: "invited",
              invitation_id: "urn:li:fsd_invitation:7483788354204020736",
              error: null,
            },
          ],
        });
      }),
    );
    const res = await companies().followInvite("112013061", { invitee_ids: ["ACoAAExampleInvitee0001"] });
    expect(seenPath).toBe("/v1/acc_co1/companies/112013061/follow-invite");
    expect(body).toEqual({ invitee_ids: ["ACoAAExampleInvitee0001"] });
    expect(res.object).toBe("company_follow_invite_result");
    expect(res.results[0]?.status).toBe("invited");
    expect(res.results[0]?.invitation_id).toBe("urn:li:fsd_invitation:7483788354204020736");
  });

  it("partial success: a mixed batch returns one outcome per invitee, in request order", async () => {
    server.use(
      http.post(`${BASE}/v1/acc_co1/companies/112013061/follow-invite`, () =>
        HttpResponse.json({
          object: "company_follow_invite_result",
          results: [
            {
              object: "company_follow_invite",
              invitee_id: "ACoAAAlreadyInvited01",
              status: "already_invited",
              invitation_id: "urn:li:fsd_invitation:7483788354204020736",
              error: null,
            },
            {
              object: "company_follow_invite",
              invitee_id: "ACoAAIneligible0001",
              status: "ineligible",
              invitation_id: null,
              error: { code: "RESOURCE_ACCESS_RESTRICTED", message: "Not an invitable 1st-degree connection." },
            },
          ],
        }),
      ),
    );
    const res = await companies().followInvite("112013061", {
      invitee_ids: ["ACoAAAlreadyInvited01", "ACoAAIneligible0001"],
    });
    expect(res.results).toHaveLength(2);
    expect(res.results[0]?.status).toBe("already_invited");
    expect(res.results[1]?.status).toBe("ineligible");
    expect(res.results[1]?.error?.code).toBe("RESOURCE_ACCESS_RESTRICTED");
  });
});

describe("companies.chats (Beta company inbox)", () => {
  it("GET /v1/{account_id}/companies/{identifier}/chats lists admin conversations", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/chats`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "company_chat_list",
          items: [{ object: "company_chat", id: "chat_a1", is_group_chat: false, unread_count: 0 }],
          cursor: null,
        });
      }),
    );
    const res = await companies().chats("112013061", { limit: 20 });
    expect(new URL(url!).pathname).toBe("/v1/acc_co1/companies/112013061/chats");
    expect(new URL(url!).searchParams.get("limit")).toBe("20");
    expect(res.object).toBe("company_chat_list");
    expect(res.items[0]?.id).toBe("chat_a1");
  });
});

describe("companies.chat (Beta company inbox)", () => {
  it("GET /v1/{account_id}/companies/{identifier}/chats/{chat_id} retrieves one conversation", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/chats/chat_a1`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "company_chat", id: "chat_a1", is_group_chat: false, unread_count: 0 });
      }),
    );
    const res = await companies().chat("112013061", "chat_a1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_co1/companies/112013061/chats/chat_a1");
    expect(res.id).toBe("chat_a1");
  });
});

describe("companies.messages (Beta company inbox)", () => {
  it("GET /v1/{account_id}/companies/{identifier}/chats/{chat_id}/messages lists thread messages, content verbatim", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/chats/chat_a1/messages`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          object: "company_chat_message_list",
          items: [{ object: "company_chat_message", id: "msg_1", conversation_id: "chat_a1", sender: { id: "ACoA1" }, sent_at: 1783415709326, text: "Following up" }],
          cursor: null,
        });
      }),
    );
    const res = await companies().messages("112013061", "chat_a1", { limit: 10 });
    expect(new URL(url!).pathname).toBe("/v1/acc_co1/companies/112013061/chats/chat_a1/messages");
    expect(res.items[0]?.text).toBe("Following up");
  });
});

describe("companies.message (Beta company inbox)", () => {
  it("GET .../chats/{chat_id}/messages/{message_id} retrieves one message", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/chats/chat_a1/messages/msg_1`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "company_chat_message", id: "msg_1", conversation_id: "chat_a1", sender: { id: "ACoA1" }, sent_at: 1783415709326, text: "Following up" });
      }),
    );
    const res = await companies().message("112013061", "chat_a1", "msg_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_co1/companies/112013061/chats/chat_a1/messages/msg_1");
    expect(res.id).toBe("msg_1");
  });
});

describe("companies.searchChats (Beta company inbox)", () => {
  it("GET .../chats/search forwards topic/unread/query/limit/cursor as query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/chats/search`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "company_chat_list", items: [], cursor: null, filter_effective: true });
      }),
    );
    const res = await companies().searchChats("112013061", { topic: "1" });
    const params = new URL(url!).searchParams;
    expect(new URL(url!).pathname).toBe("/v1/acc_co1/companies/112013061/chats/search");
    expect(params.get("topic")).toBe("1");
    expect(res.filter_effective).toBe(true);
  });

  it("free-text query mode", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_co1/companies/112013061/chats/search`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "company_chat_list", items: [], cursor: null });
      }),
    );
    await companies().searchChats("112013061", { query: "sophie" });
    expect(new URL(url!).searchParams.get("query")).toBe("sophie");
  });
});
