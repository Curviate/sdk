// comments namespace (9 methods, account-scoped, NEW namespace) — the
// comment-thread write surface relocated from `posts`. `create` was
// `posts.comment`; `listUserComments` was `profiles.listComments`.
// `reply` shares its path with `edit` (POST creates a reply, PATCH edits the
// target comment). `removeReaction` is a DELETE-with-body.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_comments", baseUrl: BASE });
const acc = client.account("acc_1");

describe("comments.listUserComments", () => {
  it("GET /v1/{account_id}/users/{user_id}/comments — relocated from profiles.listComments", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/users/me/comments`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "comment_list",
          items: [{ object: "comment", id: "c_1", text: "Nice post" }],
          cursor: null,
        });
      }),
    );
    const res = await acc.comments.listUserComments("me");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/users/me/comments");
    expect(res.items?.[0]?.id).toBe("c_1");
  });

  it("forwards limit/cursor query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/users/me/comments`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "comment_list", items: [], cursor: null });
      }),
    );
    await acc.comments.listUserComments("me", { limit: 10, cursor: "cur_1" });
    const params = new URL(url!).searchParams;
    expect(params.get("limit")).toBe("10");
    expect(params.get("cursor")).toBe("cur_1");
  });
});

describe("comments.create", () => {
  it("POST /v1/{account_id}/posts/{post_id}/comments sends {text} — was posts.comment", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts/post_1/comments`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "comment", id: "c_1", text: "Nice post!" }, { status: 201 });
      }),
    );
    const res = await acc.comments.create("post_1", { text: "Nice post!" });
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/comments");
    expect(body).toEqual({ text: "Nice post!" });
    expect(res.id).toBe("c_1");
  });

  it("sends base64 attachment objects, not FormData", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts/post_1/comments`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "comment", id: "c_2" }, { status: 201 });
      }),
    );
    await acc.comments.create("post_1", {
      text: "Check this out",
      attachments: [{ content: "aGVsbG8=", content_type: "image/png", filename: "a.png" }],
    });
    expect(body).toEqual({
      text: "Check this out",
      attachments: [{ content: "aGVsbG8=", content_type: "image/png", filename: "a.png" }],
    });
  });
});

describe("comments.edit", () => {
  it("PATCH /v1/{account_id}/posts/{post_id}/comments/{comment_id} sends {text}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.patch(`${BASE}/v1/acc_1/posts/post_1/comments/c_1`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "comment", id: "c_1", text: "Edited text." });
      }),
    );
    const res = await acc.comments.edit("post_1", "c_1", { text: "Edited text." });
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/comments/c_1");
    expect(body).toEqual({ text: "Edited text." });
    expect(res.text).toBe("Edited text.");
  });
});

describe("comments.delete", () => {
  it("DELETE /v1/{account_id}/posts/{post_id}/comments/{comment_id} — bodyless, 204", async () => {
    let seenPath: string | undefined;
    let seenBody: string | null = null;
    server.use(
      http.delete(`${BASE}/v1/acc_1/posts/post_1/comments/c_1`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenBody = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(acc.comments.delete("post_1", "c_1")).resolves.not.toThrow();
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/comments/c_1");
    expect(seenBody).toBe("");
  });
});

describe("comments.reply", () => {
  it("POST /v1/{account_id}/posts/{post_id}/comments/{comment_id} sends {text} — shares its path with edit", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts/post_1/comments/c_1`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "comment", id: "c_2", text: "Agreed!" }, { status: 201 });
      }),
    );
    const res = await acc.comments.reply("post_1", "c_1", { text: "Agreed!" });
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/comments/c_1");
    expect(body).toEqual({ text: "Agreed!" });
    expect(res.id).toBe("c_2");
  });
});

describe("comments.listReplies", () => {
  it("GET /v1/{account_id}/posts/{post_id}/comments/{comment_id}/replies", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/posts/post_1/comments/c_1/replies`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "reply_list",
          items: [{ object: "comment", id: "c_2", text: "Agreed!" }],
          cursor: null,
        });
      }),
    );
    const res = await acc.comments.listReplies("post_1", "c_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/posts/post_1/comments/c_1/replies");
    expect(res.items?.[0]?.id).toBe("c_2");
  });
});

describe("comments.listReactions", () => {
  it("GET /v1/{account_id}/posts/{post_id}/comments/{comment_id}/reactions", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/posts/post_1/comments/c_1/reactions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "reaction_list",
          items: [{ object: "reaction", value: "like", is_sender: false }],
          cursor: null,
        });
      }),
    );
    const res = await acc.comments.listReactions("post_1", "c_1");
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/posts/post_1/comments/c_1/reactions");
    expect(res.items?.[0]?.value).toBe("like");
  });
});

describe("comments.addReaction", () => {
  it("POST /v1/{account_id}/posts/{post_id}/comments/{comment_id}/reactions sends {reaction}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/acc_1/posts/post_1/comments/c_1/reactions`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "comment_reaction_added", comment_id: "c_1", reaction: "celebrate" });
      }),
    );
    const res = await acc.comments.addReaction("post_1", "c_1", { reaction: "celebrate" });
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/comments/c_1/reactions");
    expect(body).toEqual({ reaction: "celebrate" });
    expect(res.object).toBe("comment_reaction_added");
  });
});

describe("comments.removeReaction — DELETE-with-body", () => {
  it("DELETE /v1/{account_id}/posts/{post_id}/comments/{comment_id}/reactions carries {reaction}", async () => {
    let seenPath: string | undefined;
    let seenMethod: string | undefined;
    let body: unknown;
    server.use(
      http.delete(`${BASE}/v1/acc_1/posts/post_1/comments/c_1/reactions`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenMethod = request.method;
        body = await request.json();
        return HttpResponse.json({ object: "comment_reaction_removed", comment_id: "c_1", reaction: "celebrate" });
      }),
    );
    const res = await acc.comments.removeReaction("post_1", "c_1", { reaction: "celebrate" });
    expect(seenMethod).toBe("DELETE");
    expect(seenPath).toBe("/v1/acc_1/posts/post_1/comments/c_1/reactions");
    expect(body).toEqual({ reaction: "celebrate" });
    expect(res.object).toBe("comment_reaction_removed");
  });
});
