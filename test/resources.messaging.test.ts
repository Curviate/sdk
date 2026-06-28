// messaging namespace methods (14 methods, account-scoped)
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const acc = new Curviate({ apiKey: "cvt_test_msg", baseUrl: BASE }).account("acc_1");

// ─── messaging.listChats (GET /v1/chats) ────────────────────────────────────
describe("messaging.listChats", () => {
  it("GET /v1/chats returns chat list page", async () => {
    server.use(
      http.get(`${BASE}/v1/chats`, () =>
        HttpResponse.json({ object: "chat_list", items: [{ id: "chat_1" }], cursor: null }),
      ),
    );
    const res = await acc.messaging.listChats();
    expect(res.items?.[0]?.id).toBe("chat_1");
  });
});

// ─── messaging.startChat (POST /v1/chats) — multipart ─────────────────────
describe("messaging.startChat", () => {
  it("POST /v1/chats sends multipart/form-data when attachments present", async () => {
    let ct: string | null = null;
    let hasAttachmentPart = false;
    server.use(
      http.post(`${BASE}/v1/chats`, async ({ request }) => {
        ct = request.headers.get("content-type");
        if (ct?.startsWith("multipart/form-data")) {
          const form = await request.formData();
          hasAttachmentPart = form.has("attachments");
        }
        return HttpResponse.json({ object: "chat_started", chat_id: "chat_new", message_id: "msg_1" }, { status: 201 });
      }),
    );
    const buf = Buffer.from([1, 2, 3]);
    await acc.messaging.startChat({
      attendees_ids: ["ACo_r1"],
      text: "hi",
      attachments: [buf],
    });
    expect(ct).toMatch(/^multipart\/form-data/);
    expect(hasAttachmentPart).toBe(true);
  });

  it("POST /v1/chats sends JSON when no attachments", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/chats`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "chat_started", chat_id: "chat_2", message_id: "msg_2" }, { status: 201 });
      }),
    );
    await acc.messaging.startChat({ attendees_ids: ["ACo_r2"], text: "hello" });
    expect(ct).toContain("application/json");
  });
});

// ─── messaging.getChat (GET /v1/chats/:chat_id) ──────────────────────────────
describe("messaging.getChat", () => {
  it("GET /v1/chats/:chat_id returns chat detail", async () => {
    server.use(
      http.get(`${BASE}/v1/chats/chat_1`, () =>
        HttpResponse.json({ object: "chat", id: "chat_1" }),
      ),
    );
    const res = await acc.messaging.getChat("chat_1");
    expect(res.id).toBe("chat_1");
  });

  it("Chat carries subject as string when set", async () => {
    server.use(
      http.get(`${BASE}/v1/chats/chat_inmail`, () =>
        HttpResponse.json({ object: "chat", id: "chat_inmail", subject: "Opportunity at Acme" }),
      ),
    );
    const res = await acc.messaging.getChat("chat_inmail");
    expect(res.subject).toBe("Opportunity at Acme");
  });

  it("Chat carries subject as null for direct messages", async () => {
    server.use(
      http.get(`${BASE}/v1/chats/chat_dm`, () =>
        HttpResponse.json({ object: "chat", id: "chat_dm", subject: null }),
      ),
    );
    const res = await acc.messaging.getChat("chat_dm");
    expect(res.subject).toBeNull();
  });
});

// ─── messaging.listMessages (GET /v1/chats/:chat_id/messages) ───────────────
describe("messaging.listMessages", () => {
  it("GET /v1/chats/:chat_id/messages returns message page", async () => {
    server.use(
      http.get(`${BASE}/v1/chats/chat_1/messages`, () =>
        // message list items use 'id' not 'message_id'
        HttpResponse.json({ object: "message_list", items: [{ id: "msg_1" }], cursor: null }),
      ),
    );
    const res = await acc.messaging.listMessages("chat_1");
    expect(res.items?.[0]?.id).toBe("msg_1");
  });
});

// ─── messaging.sendMessage (POST /v1/chats/:chat_id/messages) ───────────────
describe("messaging.sendMessage", () => {
  it("POST /v1/chats/:chat_id/messages sends multipart when attachments", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/chats/chat_1/messages`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "message_sent", message_id: "msg_new" }, { status: 201 });
      }),
    );
    await acc.messaging.sendMessage("chat_1", {
      text: "hey",
      attachments: [Buffer.from([9, 8, 7])],
    });
    expect(ct).toMatch(/^multipart\/form-data/);
  });

  it("POST /v1/chats/:chat_id/messages sends JSON without attachments", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/chats/chat_1/messages`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ object: "message_sent", message_id: "msg_2" }, { status: 201 });
      }),
    );
    await acc.messaging.sendMessage("chat_1", { text: "plain" });
    expect(ct).toContain("application/json");
  });
});

// ─── messaging.syncChat (GET /v1/chats/:chat_id/sync) ─────────────────────────
describe("messaging.syncChat", () => {
  it("GET /v1/chats/:chat_id/sync returns sync status", async () => {
    server.use(
      http.get(`${BASE}/v1/chats/chat_1/sync`, () =>
        HttpResponse.json({ object: "chat_history_sync", chat_id: "chat_1", status: "sync_started" }),
      ),
    );
    const res = await acc.messaging.syncChat("chat_1");
    expect(res.chat_id).toBe("chat_1");
  });
});

// ─── messaging.getMessage (GET /v1/messages/:message_id) ─────────────────────
describe("messaging.getMessage", () => {
  it("GET /v1/messages/:message_id returns message", async () => {
    server.use(
      http.get(`${BASE}/v1/messages/msg_1`, () =>
        // message detail uses 'id' not 'message_id'
        HttpResponse.json({ object: "message", id: "msg_1" }),
      ),
    );
    const res = await acc.messaging.getMessage("msg_1");
    expect(res.id).toBe("msg_1");
  });
});

// ─── messaging.editMessage (PATCH /v1/messages/:message_id) ──────────────────
describe("messaging.editMessage", () => {
  it("PATCH /v1/messages/:message_id returns updated message", async () => {
    server.use(
      http.patch(`${BASE}/v1/messages/msg_1`, () =>
        // editMessage returns { object: "message_edited", message_id }
        HttpResponse.json({ object: "message_edited", message_id: "msg_1" }),
      ),
    );
    const res = await acc.messaging.editMessage("msg_1", { text: "edited" });
    expect(res.message_id).toBe("msg_1");
  });
});

// ─── messaging.deleteMessage (DELETE /v1/messages/:message_id) ───────────────
describe("messaging.deleteMessage", () => {
  it("DELETE /v1/messages/:message_id returns success", async () => {
    server.use(
      http.delete(`${BASE}/v1/messages/msg_1`, () =>
        // deleteMessage response uses 'message_id' (discriminator field, not 'id')
        HttpResponse.json({ object: "message_deleted", message_id: "msg_1" }),
      ),
    );
    const res = await acc.messaging.deleteMessage("msg_1");
    expect(res.message_id).toBe("msg_1");
  });
});

// ─── messaging.getAttachment (GET /v1/messages/:message_id/attachments/:att_id) ─
describe("messaging.getAttachment", () => {
  it("returns ArrayBuffer (binary, not JSON)", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    server.use(
      http.get(`${BASE}/v1/messages/msg_1/attachments/att_1`, () =>
        new HttpResponse(bytes.buffer, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        }),
      ),
    );
    const res = await acc.messaging.getAttachment("msg_1", "att_1");
    expect(res).toBeInstanceOf(ArrayBuffer);
    expect(res.byteLength).toBe(3);
  });
});

// ─── messaging.addReaction (POST /v1/messages/:message_id/reactions) ──────────
describe("messaging.addReaction", () => {
  it("POST /v1/messages/:message_id/reactions returns reaction", async () => {
    server.use(
      http.post(`${BASE}/v1/messages/msg_1/reactions`, () =>
        HttpResponse.json({ object: "message_reaction_added", message_id: "msg_1", reaction: "👍" }),
      ),
    );
    // addReaction body uses 'reaction' (emoji string), not reaction_type
    const res = await acc.messaging.addReaction("msg_1", { reaction: "👍" });
    expect(res.message_id).toBe("msg_1");
  });
});

// ─── messaging.sendInMail (POST /v1/messages/inmail) ─────────────────────────
describe("messaging.sendInMail", () => {
  it("POST /v1/messages/inmail sends InMail", async () => {
    server.use(
      http.post(`${BASE}/v1/messages/inmail`, () =>
        HttpResponse.json({ object: "inmail_sent", message_id: "inmail_1", chat_id: "chat_x" }, { status: 201 }),
      ),
    );
    const res = await acc.messaging.sendInMail({
      account_id: "acc_1",
      recipient_urn: "urn:li:member:99",
      surface: "sales_nav",
      subject: "Hi",
      text: "Hello",
    });
    expect(res.message_id).toBe("inmail_1");
  });
});

// ─── messaging.getInMailBalance (GET /v1/messaging/inmail-balance) ─────────────
describe("messaging.getInMailBalance", () => {
  it("GET /v1/messaging/inmail-balance returns balance", async () => {
    server.use(
      http.get(`${BASE}/v1/messaging/inmail-balance`, () =>
        HttpResponse.json({ object: "inmail_balance", premium: 10, recruiter: 0, sales_navigator: 5 }),
      ),
    );
    const res = await acc.messaging.getInMailBalance();
    expect(res.premium).toBe(10);
  });
});

// ─── messaging.syncMessages (GET /v1/messages/sync) ─────────────────────────
describe("messaging.syncMessages", () => {
  it("GET /v1/messages/sync returns sync status", async () => {
    server.use(
      http.get(`${BASE}/v1/messages/sync`, () =>
        HttpResponse.json({ object: "account_sync", account_id: "acc_1", sync_status: "running" }),
      ),
    );
    const res = await acc.messaging.syncMessages();
    expect(res.sync_status).toBe("running");
  });
});
