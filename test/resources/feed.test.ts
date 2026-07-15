// feed namespace (1 method, account-scoped, NEW namespace) — read the
// connected account's home feed as agent-actionable posts. Two sort orders on
// one endpoint; the stream is unbounded and carries no total count. Account-
// scoped ONLY — reachable via client.account(id).feed, never the root client.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";
import { CurviateError, isCurviateError } from "../../src/errors.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_feed", baseUrl: BASE });
const acc = client.account("acc_1");

describe("feed.home", () => {
  it("GET /v1/{account_id}/feed/home — default (no query)", async () => {
    let capturedPath: string | undefined;
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/feed/home`, ({ request }) => {
        const url = new URL(request.url);
        capturedPath = url.pathname;
        search = url.searchParams;
        return HttpResponse.json({
          object: "feed_post_list",
          items: [{ object: "feed_post", id: "post_1" }],
          cursor: "cur_next",
        });
      }),
    );
    const res = await acc.feed.home();
    expect(capturedPath).toBe("/v1/acc_1/feed/home");
    expect(search?.has("sort")).toBe(false);
    expect(res.object).toBe("feed_post_list");
    expect(res.cursor).toBe("cur_next");
    expect(res.items?.length).toBe(1);
  });

  it("forwards sort/limit/cursor query params", async () => {
    let search: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/feed/home`, ({ request }) => {
        search = new URL(request.url).searchParams;
        return HttpResponse.json({ object: "feed_post_list", items: [], cursor: null });
      }),
    );
    await acc.feed.home({ sort: "relevant", limit: 5, cursor: "cur_1" });
    expect(search?.get("sort")).toBe("relevant");
    expect(search?.get("limit")).toBe("5");
    expect(search?.get("cursor")).toBe("cur_1");
  });
});

describe("feed error envelope", () => {
  it("a corrupt cursor surfaces the server's 400 as CurviateError(INVALID_REQUEST)", async () => {
    server.use(
      http.get(`${BASE}/v1/acc_1/feed/home`, () =>
        HttpResponse.json(
          {
            code: "INVALID_REQUEST",
            message: "cursor is corrupt, foreign, or expired.",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 400 },
        ),
      ),
    );
    let caught: unknown;
    try {
      await acc.feed.home({ cursor: "corrupt-cursor" });
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
    expect((caught as CurviateError).httpStatus).toBe(400);
  });
});

describe("feed namespace mounting", () => {
  it("is account-scoped only — mounted on account(id), never the root client", () => {
    expect(acc).toHaveProperty("feed");
    expect(client).not.toHaveProperty("feed");
  });
});
