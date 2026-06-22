// account_id injection location — per-endpoint, method-dependent.
//
// The account-scoped context (`curviate.account(id)`) injects `account_id` into
// each request. WHERE it goes depends on the endpoint:
//   - account-scoped write POSTs WITH a body -> the BODY
//       * JSON-body POSTs       -> a field in the JSON object
//       * multipart/FormData    -> a form field appended to the FormData
//   - GET reads, body-less DELETEs, and filter-search POSTs -> the QUERY string
//
// These tests assert the wire shape across namespaces. They fail against the
// pre-fix behaviour (which always put account_id in the query) for the body
// cases, and they guard the query cases against regression.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const ACC = "acc_test";
const client = new Curviate({ apiKey: "cvt_test_acctloc", baseUrl: BASE });
const acc = client.account(ACC);

/** Capture the JSON body of a single intercepted request. */
function captureJsonBody(method: "post" | "patch", url: string, status = 200) {
  const captured: { body?: Record<string, unknown>; query?: string | null } = {};
  server.use(
    http[method](url, async ({ request }) => {
      captured.query = new URL(request.url).searchParams.get("account_id");
      captured.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ok: true }, { status });
    }),
  );
  return captured;
}

/** Capture the FormData fields of a single intercepted multipart request. */
function captureFormBody(url: string, status = 201) {
  const captured: { accountField?: string | null; query?: string | null; ct?: string | null } = {};
  server.use(
    http.post(url, async ({ request }) => {
      captured.ct = request.headers.get("content-type");
      captured.query = new URL(request.url).searchParams.get("account_id");
      const form = await request.formData();
      const v = form.get("account_id");
      captured.accountField = typeof v === "string" ? v : v == null ? null : "(file)";
      return HttpResponse.json({ ok: true }, { status });
    }),
  );
  return captured;
}

/** Capture the query account_id of a single intercepted request. */
function captureQuery(method: "get" | "delete" | "post", url: string, status = 200) {
  const captured: { query?: string | null; bodyAccount?: unknown } = {};
  server.use(
    http[method](url, async ({ request }) => {
      captured.query = new URL(request.url).searchParams.get("account_id");
      if (method === "post") {
        try {
          const b = (await request.json()) as Record<string, unknown>;
          captured.bodyAccount = b.account_id;
        } catch {
          captured.bodyAccount = undefined;
        }
      }
      return HttpResponse.json({ object: "ok", items: [], cursor: null }, { status });
    }),
  );
  return captured;
}

// ─── JSON-body write POSTs: account_id belongs in the BODY ──────────────────
describe("account_id in body — JSON write POSTs", () => {
  it("invites.send (POST /v1/invites) puts account_id in the JSON body, not the query", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/invites`, 201);
    await acc.invites.send({ identifier: "ACoAAA" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("invites.respond (POST /v1/invites/received/:id) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/invites/received/inv_1`);
    await acc.invites.respond("inv_1", { action: "accept" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("messaging.sendInMail (POST /v1/messages/inmail) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/messages/inmail`, 201);
    await acc.messaging.sendInMail({
      recipient_urn: "urn:li:member:1",
      surface: "sales_nav",
      subject: "Hi",
      text: "Hello",
    } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("messaging.addReaction (POST /v1/messages/:id/reactions) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/messages/msg_1/reactions`);
    await acc.messaging.addReaction("msg_1", { reaction: "👍" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("messaging.startChat (POST /v1/chats, JSON variant) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/chats`, 201);
    await acc.messaging.startChat({ attendees_ids: ["ACo_r1"], text: "hi" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("posts.react (POST /v1/posts/:id/reactions) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/posts/post_1/reactions`);
    await acc.posts.react("post_1", { reaction: "like" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("profiles.endorse (POST /v1/profiles/:id/endorse) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/profiles/prof_1/endorse`);
    await acc.profiles.endorse("prof_1", { skill_endorsement_id: "skill_1" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("salesNavigator.saveLead (POST /v1/sales-navigator/leads/:id) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/sales-navigator/leads/usr_1`);
    await acc.salesNavigator.saveLead("usr_1", {} as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("recruiter.createJob (POST /v1/recruiter/jobs) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/recruiter/jobs`);
    await acc.recruiter.createJob({ title: "Engineer" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("recruiter.addCandidate (POST /v1/recruiter/projects/candidates/:id) puts account_id in the body", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/recruiter/projects/candidates/usr_1`);
    await acc.recruiter.addCandidate("usr_1", { hiring_project_id: "proj_1" } as never);
    expect(cap.body?.account_id).toBe(ACC);
    expect(cap.query).toBeNull();
  });
});

// ─── Multipart write POSTs: account_id appended as a FormData field ─────────
describe("account_id in body — multipart write POSTs", () => {
  it("messaging.sendMessage with attachments appends account_id as a FormData field", async () => {
    const cap = captureFormBody(`${BASE}/v1/chats/chat_1/messages`);
    await acc.messaging.sendMessage("chat_1", {
      text: "hey",
      attachments: [Buffer.from([1, 2, 3])],
    } as never);
    expect(cap.ct).toMatch(/^multipart\/form-data/);
    expect(cap.accountField).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("posts.create (always multipart) appends account_id as a FormData field", async () => {
    const cap = captureFormBody(`${BASE}/v1/posts`);
    await acc.posts.create({ text: "hello world" } as never);
    expect(cap.ct).toMatch(/^multipart\/form-data/);
    expect(cap.accountField).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("posts.comment (always multipart) appends account_id as a FormData field", async () => {
    const cap = captureFormBody(`${BASE}/v1/posts/post_1/comments`);
    await acc.posts.comment("post_1", { text: "nice" } as never);
    expect(cap.accountField).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("salesNavigator.startChat with a voice message appends account_id as a FormData field", async () => {
    const cap = captureFormBody(`${BASE}/v1/sales-navigator/chats`);
    await acc.salesNavigator.startChat({
      attendees_ids: ["ACo_r1"],
      text: "hi",
      voice_message: Buffer.from([4, 5, 6]),
    } as never);
    expect(cap.accountField).toBe(ACC);
    expect(cap.query).toBeNull();
  });

  it("recruiter.startChat with attachments appends account_id as a FormData field", async () => {
    const cap = captureFormBody(`${BASE}/v1/recruiter/chats`);
    await acc.recruiter.startChat({
      attendees_ids: ["ACo_r1"],
      text: "hi",
      attachments: [Buffer.from([7, 8, 9])],
    } as never);
    expect(cap.accountField).toBe(ACC);
    expect(cap.query).toBeNull();
  });
});

// ─── GET reads keep account_id in the query (no regression) ─────────────────
describe("account_id in query — GET reads", () => {
  it("messaging.listChats (GET /v1/chats) keeps account_id in the query", async () => {
    const cap = captureQuery("get", `${BASE}/v1/chats`);
    await acc.messaging.listChats();
    expect(cap.query).toBe(ACC);
  });

  it("posts.list (GET /v1/posts) keeps account_id in the query", async () => {
    const cap = captureQuery("get", `${BASE}/v1/posts`);
    await acc.posts.list();
    expect(cap.query).toBe(ACC);
  });
});

// ─── Body-less DELETEs keep account_id in the query (no regression) ─────────
describe("account_id in query — body-less DELETEs", () => {
  it("messaging.deleteMessage (DELETE /v1/messages/:id) keeps account_id in the query", async () => {
    const cap = captureQuery("delete", `${BASE}/v1/messages/msg_1`);
    await acc.messaging.deleteMessage("msg_1");
    expect(cap.query).toBe(ACC);
  });

  it("invites.cancel (DELETE /v1/invites/:id) keeps account_id in the query", async () => {
    const cap = captureQuery("delete", `${BASE}/v1/invites/inv_1`);
    await acc.invites.cancel("inv_1");
    expect(cap.query).toBe(ACC);
  });
});

// ─── Filter-search POSTs keep account_id in the query (no regression) ───────
describe("account_id in query — filter-search POSTs (body present, but account_id is a query param)", () => {
  it("search.people (POST /v1/search/people) keeps account_id in the query, not the body", async () => {
    const cap = captureQuery("post", `${BASE}/v1/search/people`);
    await acc.search.people({ keywords: "engineer" } as never);
    expect(cap.query).toBe(ACC);
    expect(cap.bodyAccount).toBeUndefined();
  });

  it("salesNavigator.searchPeople (POST /v1/sales-navigator/search/people) keeps account_id in the query", async () => {
    const cap = captureQuery("post", `${BASE}/v1/sales-navigator/search/people`);
    await acc.salesNavigator.searchPeople({ keywords: "engineer" } as never);
    expect(cap.query).toBe(ACC);
    expect(cap.bodyAccount).toBeUndefined();
  });

  it("recruiter.searchPeople (POST /v1/recruiter/search/people) keeps account_id in the query", async () => {
    const cap = captureQuery("post", `${BASE}/v1/recruiter/search/people`);
    await acc.recruiter.searchPeople({ keywords: "engineer" } as never);
    expect(cap.query).toBe(ACC);
    expect(cap.bodyAccount).toBeUndefined();
  });
});

// ─── Caller-supplied account_id wins / is never double-injected ─────────────
describe("caller-supplied account_id wins", () => {
  it("a body POST honours a caller-supplied account_id (no override, no query copy)", async () => {
    const cap = captureJsonBody("post", `${BASE}/v1/invites`, 201);
    await acc.invites.send({ identifier: "ACoAAA", account_id: "acc_override" } as never);
    expect(cap.body?.account_id).toBe("acc_override");
    expect(cap.query).toBeNull();
  });

  it("a multipart POST honours a caller-supplied account_id form field", async () => {
    const cap = captureFormBody(`${BASE}/v1/posts`);
    await acc.posts.create({ text: "hi", account_id: "acc_override" } as never);
    expect(cap.accountField).toBe("acc_override");
    expect(cap.query).toBeNull();
  });
});
