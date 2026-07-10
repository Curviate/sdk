// invites namespace (6 methods, account-scoped) — path realign to the
// account-first grammar; the old combined `respond` splits into two
// dedicated, bodyless POSTs (accept/decline).
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const client = new Curviate({ apiKey: "cvt_test_invites", baseUrl: BASE });
const acc = client.account("acc_1");

describe("invites.send", () => {
  it("POST /v1/{account_id}/invites sends {recipient_identifier,message}", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/acc_1/invites`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { object: "invitation_sent", id: "SENT_1", status: "sent" },
          { status: 201 },
        );
      }),
    );
    const res = await acc.invites.send({ recipient_identifier: "ACo_r1", message: "Let's connect" });
    expect(seenPath).toBe("/v1/acc_1/invites");
    expect(body).toEqual({ recipient_identifier: "ACo_r1", message: "Let's connect" });
    expect(res.id).toBe("SENT_1");
  });
});

describe("invites.listSent", () => {
  it("GET /v1/{account_id}/invites/sent", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/invites/sent`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "invitation_list",
          items: [{ object: "invitation_sent", id: "SENT_1", user: { id: "u_1" } }],
          cursor: null,
        });
      }),
    );
    const res = await acc.invites.listSent();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/invites/sent");
    expect(res.items?.[0]?.id).toBe("SENT_1");
  });

  it("forwards cursor/limit as query params", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/invites/sent`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "invitation_list", items: [], cursor: null });
      }),
    );
    await acc.invites.listSent({ cursor: "cur_1", limit: 50 });
    const params = new URL(url!).searchParams;
    expect(params.get("cursor")).toBe("cur_1");
    expect(params.get("limit")).toBe("50");
  });
});

describe("invites.listReceived", () => {
  it("GET /v1/{account_id}/invites/received", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/acc_1/invites/received`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "invitation_list",
          items: [{ object: "invitation_received", id: "RECEIVED_1", user: { id: "u_2" } }],
          cursor: null,
        });
      }),
    );
    const res = await acc.invites.listReceived();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/acc_1/invites/received");
    expect(res.items?.[0]?.id).toBe("RECEIVED_1");
  });
});

describe("invites.accept / invites.decline — bodyless, split from the old respond", () => {
  it("POST /v1/{account_id}/invites/received/{invitation_id}/accept — no body", async () => {
    let seenPath: string | undefined;
    let seenBody: string | null = null;
    server.use(
      http.post(`${BASE}/v1/acc_1/invites/received/inv_9/accept`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenBody = await request.text();
        return HttpResponse.json({ object: "invitation_accepted", invitation_id: "inv_9", status: "accepted" });
      }),
    );
    const res = await acc.invites.accept("inv_9");
    expect(seenPath).toBe("/v1/acc_1/invites/received/inv_9/accept");
    expect(seenBody).toBe("");
    expect(res.status).toBe("accepted");
  });

  it("POST /v1/{account_id}/invites/received/{invitation_id}/decline — no body", async () => {
    let seenPath: string | undefined;
    let seenBody: string | null = null;
    server.use(
      http.post(`${BASE}/v1/acc_1/invites/received/inv_9/decline`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenBody = await request.text();
        return HttpResponse.json({ object: "invitation_declined", invitation_id: "inv_9", status: "declined" });
      }),
    );
    const res = await acc.invites.decline("inv_9");
    expect(seenPath).toBe("/v1/acc_1/invites/received/inv_9/decline");
    expect(seenBody).toBe("");
    expect(res.status).toBe("declined");
  });

  it("respond is not a method — superseded by accept/decline", () => {
    expect((acc.invites as unknown as Record<string, unknown>)["respond"]).toBeUndefined();
  });
});

describe("invites.cancel", () => {
  it("DELETE /v1/{account_id}/invites/sent/{invitation_id} — bodyless", async () => {
    let seenPath: string | undefined;
    let seenBody: string | null = null;
    server.use(
      http.delete(`${BASE}/v1/acc_1/invites/sent/inv_1`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenBody = await request.text();
        return HttpResponse.json({ object: "invitation_withdrawn", invitation_id: "inv_1", status: "withdrawn" });
      }),
    );
    const res = await acc.invites.cancel("inv_1");
    expect(seenPath).toBe("/v1/acc_1/invites/sent/inv_1");
    expect(seenBody).toBe("");
    expect(res.invitation_id).toBe("inv_1");
    expect(res.status).toBe("withdrawn");
  });
});
