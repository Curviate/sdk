// groups namespace (3 methods, account-scoped, NEW namespace) — read the
// LinkedIn groups a member belongs to (`list`), one group's full detail
// (`get`), and a group's member roster (`members`). `list` reads the
// connected account's own groups by default; `members` folds the member-name
// search in as a `{ name }` filter. Account-scoped ONLY.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";
import { CurviateError, isCurviateError } from "../../src/errors.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_groups", baseUrl: BASE });
const acc = client.account("acc_1");

describe("groups.list", () => {
  it("GET /v1/{account_id}/profile/groups — own groups by default", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/groups`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "group_list",
          items: [{ object: "group", id: "grp_1", name: "AI Engineers" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await acc.groups.list();
    expect(capturedPath).toBe("/v1/acc_1/profile/groups");
    expect(res.object).toBe("group_list");
    expect(res.items?.[0]?.id).toBe("grp_1");
  });

  it("forwards profile/limit/cursor query params", async () => {
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/profile/groups`, ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ object: "group_list", items: [], paging: { total_count: null }, cursor: null });
      }),
    );
    await acc.groups.list({ profile: "dana-lee", limit: 10, cursor: "cur_1" });
    expect(search?.get("profile")).toBe("dana-lee");
    expect(search?.get("limit")).toBe("10");
    expect(search?.get("cursor")).toBe("cur_1");
  });
});

describe("groups.get", () => {
  it("GET /v1/{account_id}/groups/{group} — single group detail", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/groups/grp_1`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "group",
          id: "grp_1",
          name: "AI Engineers",
          member_count: 5120,
          is_member: true,
          membership_status: "member",
        });
      }),
    );
    const res = await acc.groups.get("grp_1");
    expect(capturedPath).toBe("/v1/acc_1/groups/grp_1");
    expect(res.object).toBe("group");
    expect(res.id).toBe("grp_1");
    expect(res.member_count).toBe(5120);
  });
});

describe("groups.members", () => {
  it("GET /v1/{account_id}/groups/{group}/members — roster", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/groups/grp_1/members`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "group_member_list",
          items: [{ object: "group_member", id: "ACo1", name: "Dana Lee", headline: "AI Engineer" }],
          paging: { total_count: 1 },
          cursor: null,
        });
      }),
    );
    const res = await acc.groups.members("grp_1");
    expect(capturedPath).toBe("/v1/acc_1/groups/grp_1/members");
    expect(res.object).toBe("group_member_list");
    expect(res.items?.[0]?.id).toBe("ACo1");
  });

  it("forwards the folded-in name filter (member search) + pagination", async () => {
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/groups/grp_1/members`, ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ object: "group_member_list", items: [], paging: { total_count: 0 }, cursor: null });
      }),
    );
    await acc.groups.members("grp_1", { name: "dana", limit: 25, cursor: "cur_2" });
    expect(search?.get("name")).toBe("dana");
    expect(search?.get("limit")).toBe("25");
    expect(search?.get("cursor")).toBe("cur_2");
  });
});

describe("groups error envelope", () => {
  it("a malformed group surfaces the server's 400 as CurviateError(INVALID_REQUEST)", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/groups/grp_bad/members`, () =>
        HttpResponse.json(
          {
            code: "INVALID_REQUEST",
            message: "group must be a valid group id or URL.",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 400 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await acc.groups.members("grp_bad");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
    expect((caught as CurviateError).httpStatus).toBe(400);
  });
});

describe("groups namespace mounting", () => {
  it("is account-scoped only — mounted on account(id), never the root client", () => {
    expect(acc).toHaveProperty("groups");
    expect(client).not.toHaveProperty("groups");
  });
});
