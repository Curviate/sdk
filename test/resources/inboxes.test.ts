// inboxes namespace (2 methods, account-scoped, NEW namespace, BETA) — discover
// the account's personal + company-page inboxes (`list`) and read a single
// inbox's conversations (`listChats`). Every chat id returned is send-ready:
// pass it directly to `messaging.sendMessage()` to reply. Account-scoped ONLY
// — reachable via client.account(id).inboxes, never the root client.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";
import { CurviateError, isCurviateError } from "../../src/errors.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_inboxes", baseUrl: BASE });
const acc = client.account("acc_1");

describe("inboxes.list", () => {
  it("GET /v1/{account_id}/inboxes — personal + company inboxes, no query by default", async () => {
    let capturedPath: string | undefined;
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes`, ({ request }) => {
        const url = new URL(request.url);
        capturedPath = url.pathname;
        search = url.searchParams;
        return HttpResponse.json({
          object: "inbox_list",
          items: [
            {
              object: "inbox",
              id: "CLASSIC_PRIMARY",
              kind: "personal",
              folder: "primary",
              name: "Primary",
              company_id: null,
              mailbox_id: null,
              reply_only: false,
            },
            {
              object: "inbox",
              id: "COMPANY_83734124_PRIMARY",
              kind: "company",
              folder: "primary",
              name: "RedHire",
              company_id: "112013061",
              mailbox_id: "83734124",
              reply_only: true,
            },
          ],
        });
      }),
    );
    const res = await acc.inboxes.list();
    expect(capturedPath).toBe("/v1/acc_1/inboxes");
    expect(search?.size ?? 0).toBe(0);
    expect(res.object).toBe("inbox_list");
    expect(res.items?.length).toBe(2);
    expect(res.items?.[1]?.reply_only).toBe(true);
    expect(res.items?.[1]?.company_id).toBe("112013061");
  });

  it("forwards kind/company_id query filters", async () => {
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes`, ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ object: "inbox_list", items: [] });
      }),
    );
    await acc.inboxes.list({ kind: "company", company_id: "112013061" });
    expect(search?.get("kind")).toBe("company");
    expect(search?.get("company_id")).toBe("112013061");
  });

  it("surfaces hint when no company inbox exists — not silent emptiness", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes`, () =>
        HttpResponse.json({
          object: "inbox_list",
          items: [
            {
              object: "inbox",
              id: "CLASSIC_PRIMARY",
              kind: "personal",
              folder: "primary",
              name: "Primary",
              company_id: null,
              mailbox_id: null,
              reply_only: false,
            },
          ],
          hint: "No company inboxes found. Reconnect this account with the Company Pages scope to attach one.",
        }),
      ),
    );
    const res = await acc.inboxes.list();
    expect(res.items?.length).toBe(1);
    expect(res.hint).toContain("Company Pages");
  });
});

describe("inboxes.listChats", () => {
  it("GET /v1/{account_id}/inboxes/{inbox_id}/chats — a page of conversations", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes/COMPANY_83734124_PRIMARY/chats`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json({
          object: "inbox_chat_list",
          items: [{ id: "COMPANY_83734124_2-YTQ3ODU3Njgt" }],
          cursor: null,
        });
      }),
    );
    const res = await acc.inboxes.listChats("COMPANY_83734124_PRIMARY");
    expect(capturedPath).toBe("/v1/acc_1/inboxes/COMPANY_83734124_PRIMARY/chats");
    expect(res.object).toBe("inbox_chat_list");
    expect(res.items?.[0]?.["id"]).toBe("COMPANY_83734124_2-YTQ3ODU3Njgt");
    expect(res.cursor).toBeNull();
  });

  it("forwards limit/cursor query params", async () => {
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes/CLASSIC_PRIMARY/chats`, ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ object: "inbox_chat_list", items: [], cursor: null });
      }),
    );
    await acc.inboxes.listChats("CLASSIC_PRIMARY", { limit: 10, cursor: "cur_1" });
    expect(search?.get("limit")).toBe("10");
    expect(search?.get("cursor")).toBe("cur_1");
  });
});

describe("inboxes error envelope", () => {
  it("an unknown inbox_id surfaces the server's 404 as CurviateError(RESOURCE_NOT_FOUND)", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes/BOGUS_ID/chats`, () =>
        HttpResponse.json(
          {
            code: "RESOURCE_NOT_FOUND",
            message: "The referenced resource does not exist for this tenant.",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 404 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await acc.inboxes.listChats("BOGUS_ID");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("RESOURCE_NOT_FOUND");
    expect((caught as CurviateError).httpStatus).toBe(404);
  });

  it("a non-admin's company inbox surfaces the server's 403 as CurviateError(RESOURCE_ACCESS_RESTRICTED)", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/inboxes/COMPANY_99_PRIMARY/chats`, () =>
        HttpResponse.json(
          {
            code: "RESOURCE_ACCESS_RESTRICTED",
            message: "The connected account is not an admin of this page.",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 403 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await acc.inboxes.listChats("COMPANY_99_PRIMARY");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("RESOURCE_ACCESS_RESTRICTED");
    expect((caught as CurviateError).httpStatus).toBe(403);
  });
});

describe("inboxes namespace mounting", () => {
  it("is account-scoped only — mounted on account(id), never the root client", () => {
    expect(acc).toHaveProperty("inboxes");
    expect(client).not.toHaveProperty("inboxes");
  });
});
