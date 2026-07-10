// posts namespace (9 methods, account-scoped) — path realign to the
// account-first grammar; `create` drops multipart entirely (JSON + base64
// attachments — the served surface has zero multipart ops); new `delete`
// (bodyless, 204) and `unreact` (DELETE-with-body); `listUserPosts` /
// `listUserReactions` relocate from the old `profiles.listPosts` /
// `profiles.listReactions`. The orphaned `list()` (no served op) is gone.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_posts", baseUrl: BASE });
const acc = client.account("acc_1");

describe("posts.listComments", () => {
  it("GET /v1/{account_id}/posts/{post_id}/comments", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/posts/post_1/comments`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "comment_list",
          items: [{ object: "comment", id: "c_1", text: "Nice post" }],
          cursor: null,
        });
      }),
    );
    const res = await acc.posts.listComments("post_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/posts/post_1/comments");
    expect(res.items?.[0]?.id).toBe("c_1");
  });

  it("forwards cursor/limit/sort_by as query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/posts/post_1/comments`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "comment_list", items: [], cursor: null });
      }),
    );
    await acc.posts.listComments("post_1", { cursor: "cur_1", limit: 10, sort_by: "MOST_RELEVANT" });
    const params = new URL(url!).searchParams;
    expect(params.get("cursor")).toBe("cur_1");
    expect(params.get("limit")).toBe("10");
    expect(params.get("sort_by")).toBe("MOST_RELEVANT");
  });
});

describe("posts.get", () => {
  it("GET /v1/{account_id}/posts/{post_id}", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/posts/post_1`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "post", id: "post_1", text: "Hello world" });
      }),
    );
    const res = await acc.posts.get("post_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/posts/post_1");
    expect(res.id).toBe("post_1");
  });
});

describe("posts.delete", () => {
  it("DELETE /v1/{account_id}/posts/{post_id} — bodyless, 204", async () => {
    let seenPath: string | undefined;
    let seenBody: string | null = null;
    server.use(
      http.delete(`${BASE}/v1/acc_1/posts/post_1`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(acc.posts.delete("post_1")).resolves.not.toThrow();
    expect(seenPath).toBe("/v1/acc_1/posts/post_1");
    expect(seenBody).toBe("");
  });
});

describe("posts.create", () => {
  it("POST /v1/{account_id}/posts sends application/json — never multipart", async () => {
    let ct: string | null = null;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts`, async ({ request }) => {
        ct = request.headers.get("content-type");
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "post_created", id: "urn:li:ugcPost:1" }, { status: 201 });
      }),
    );
    const res = await acc.posts.create({ text: "My first post" });
    expect(ct).toMatch(/^application\/json/);
    expect(body).toEqual({ text: "My first post" });
    expect(res.id).toBe("urn:li:ugcPost:1");
  });

  it("sends base64 attachment objects, not FormData", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "post_created", id: "urn:li:ugcPost:2" }, { status: 201 });
      }),
    );
    await acc.posts.create({
      text: "With an image",
      attachments: [{ content: "aGVsbG8=", content_type: "image/png", filename: "a.png" }],
    });
    expect(body).toEqual({
      text: "With an image",
      attachments: [{ content: "aGVsbG8=", content_type: "image/png", filename: "a.png" }],
    });
  });
});

describe("posts.listUserPosts", () => {
  it("GET /v1/{account_id}/users/{user_id}/posts — relocated from profiles.listPosts", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/users/me/posts`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "post_list",
          items: [{ object: "post", id: "post_1" }],
          cursor: null,
        });
      }),
    );
    const res = await acc.posts.listUserPosts("me");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/users/me/posts");
    expect(res.items?.[0]?.id).toBe("post_1");
  });
});

describe("posts.listReactions", () => {
  it("GET /v1/{account_id}/posts/{post_id}/reactions", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/posts/post_1/reactions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "reaction_list",
          items: [{ object: "reaction", value: "like", is_sender: false }],
          cursor: null,
        });
      }),
    );
    const res = await acc.posts.listReactions("post_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/posts/post_1/reactions");
    expect(res.items?.[0]?.value).toBe("like");
  });
});

describe("posts.react", () => {
  it("POST /v1/{account_id}/posts/{post_id}/reactions sends {reaction}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts/post_1/reactions`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "reaction_added", reaction: "like" });
      }),
    );
    const res = await acc.posts.react("post_1", { reaction: "like" });
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/reactions");
    expect(body).toEqual({ reaction: "like" });
    expect(res.object).toBe("reaction_added");
  });
});

describe("posts.unreact — DELETE-with-body", () => {
  it("DELETE /v1/{account_id}/posts/{post_id}/reactions carries {reaction}", async () => {
    let seenPath: string | undefined;
    let seenMethod: string | undefined;
    let body: unknown;
    server.use(
      http.delete(`${BASE}/v1/acc_1/posts/post_1/reactions`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenMethod = request.method;
        body = await request.json();
        return HttpResponse.json({ object: "reaction_removed", reaction: "like" });
      }),
    );
    const res = await acc.posts.unreact("post_1", { reaction: "like" });
    expect(seenMethod).toBe("DELETE");
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/reactions");
    expect(body).toEqual({ reaction: "like" });
    expect(res.object).toBe("reaction_removed");
  });
});

describe("posts.listUserReactions", () => {
  it("GET /v1/{account_id}/users/{user_id}/reactions — relocated from profiles.listReactions", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/users/me/reactions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "reaction_list",
          items: [{ object: "reaction", value: "celebrate", is_sender: true }],
          cursor: null,
        });
      }),
    );
    const res = await acc.posts.listUserReactions("me");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/users/me/reactions");
    expect(res.items?.[0]?.value).toBe("celebrate");
  });
});

describe("posts.list removal (no served op)", () => {
  it("stays absent from the posts resource surface", () => {
    expect((acc.posts as unknown as Record<string, unknown>)["list"]).toBeUndefined();
  });
});
