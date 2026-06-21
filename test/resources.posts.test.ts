// sdk/002 — posts namespace (7 methods, account-scoped)
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const acc = new Curviate({ apiKey: "cvt_test_posts", baseUrl: BASE }).account("acc_1");

describe("posts.list", () => {
  it("GET /v1/posts returns own post page", async () => {
    server.use(
      http.get(`${BASE}/v1/posts`, () =>
        HttpResponse.json({ object: "post_list", items: [{ social_id: "p_1" }], cursor: null }),
      ),
    );
    const res = await acc.posts.list();
    // posts use social_id, not post_id
    expect(res.items?.[0]?.social_id).toBe("p_1");
  });
});

describe("posts.create", () => {
  it("POST /v1/posts always sends multipart/form-data (posts are multipart-only)", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/posts`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "post_created", social_id: "p_new" }, { status: 201 });
      }),
    );
    await acc.posts.create({
      text: "My first post",
      attachments: [Buffer.from([0xff, 0xd8])],
    });
    expect(ct).toMatch(/^multipart\/form-data/);
  });

  it("POST /v1/posts sends multipart even without attachments (endpoint is multipart-only)", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/posts`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "post_created", social_id: "p_text" }, { status: 201 });
      }),
    );
    await acc.posts.create({ text: "Text only post" });
    expect(ct).toMatch(/^multipart\/form-data/);
  });
});

describe("posts.get", () => {
  it("GET /v1/posts/:post_id returns post", async () => {
    server.use(
      http.get(`${BASE}/v1/posts/p_1`, () =>
        HttpResponse.json({ object: "post", social_id: "p_1", text: "Hello world" }),
      ),
    );
    const res = await acc.posts.get("p_1");
    // post detail has social_id
    expect(res.social_id).toBe("p_1");
  });
});

describe("posts.listComments", () => {
  it("GET /v1/posts/:post_id/comments returns comment page", async () => {
    server.use(
      http.get(`${BASE}/v1/posts/p_1/comments`, () =>
        HttpResponse.json({ object: "comment_list", items: [{ social_id: "c_1" }], cursor: null }),
      ),
    );
    const res = await acc.posts.listComments("p_1");
    expect(res.items?.[0]?.social_id).toBe("c_1");
  });
});

describe("posts.comment", () => {
  it("POST /v1/posts/:post_id/comments sends multipart", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/posts/p_1/comments`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "comment_added", social_id: "c_new" }, { status: 201 });
      }),
    );
    await acc.posts.comment("p_1", {
      text: "Great post!",
      attachments: [Buffer.from([0x01])],
    });
    expect(ct).toMatch(/^multipart\/form-data/);
  });

  it("POST /v1/posts/:post_id/comments sends multipart even without attachments", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/posts/p_1/comments`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "comment_added", social_id: "c_txt" }, { status: 201 });
      }),
    );
    await acc.posts.comment("p_1", { text: "Nice!" });
    expect(ct).toMatch(/^multipart\/form-data/);
  });
});

describe("posts.listReactions", () => {
  it("GET /v1/posts/:post_id/reactions returns reaction page", async () => {
    server.use(
      http.get(`${BASE}/v1/posts/p_1/reactions`, () =>
        HttpResponse.json({ object: "reaction_list", items: [{ value: "LIKE" }], cursor: null }),
      ),
    );
    const res = await acc.posts.listReactions("p_1");
    expect(res.items?.[0]?.value).toBe("LIKE");
  });
});

describe("posts.react", () => {
  it("POST /v1/posts/:post_id/reactions returns reaction result", async () => {
    server.use(
      http.post(`${BASE}/v1/posts/p_1/reactions`, () =>
        // react body uses 'reaction' (lowercase enum), not reaction_type
        HttpResponse.json({ object: "reaction_added", reaction: "like" }),
      ),
    );
    const res = await acc.posts.react("p_1", { account_id: "acc_1", reaction: "like" });
    expect(res.reaction).toBe("like");
  });
});
