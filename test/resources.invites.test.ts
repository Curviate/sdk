// invites namespace (5 methods, account-scoped)
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const acc = new Curviate({ apiKey: "cvt_test_inv", baseUrl: BASE }).account("acc_1");

describe("invites.send", () => {
  it("POST /v1/invites returns sent invitation (201)", async () => {
    server.use(
      http.post(`${BASE}/v1/invites`, () =>
        // 201 = sent; 200 = already_connected|already_pending
        HttpResponse.json({ object: "invitation_sent", invitation_id: "inv_1", status: "sent" }, { status: 201 }),
      ),
    );
    // send requires: account_id, recipient_identifier (not recipient_id)
    const res = await acc.invites.send({ account_id: "acc_1", recipient_identifier: "ACo_r1" });
    expect(res.invitation_id).toBe("inv_1");
  });
});

describe("invites.listSent", () => {
  it("GET /v1/invites/sent returns sent invitation page", async () => {
    server.use(
      http.get(`${BASE}/v1/invites/sent`, () =>
        HttpResponse.json({ object: "invitation_list", items: [{ id: "inv_1" }], cursor: null }),
      ),
    );
    const res = await acc.invites.listSent();
    expect(res.items?.[0]?.id).toBe("inv_1");
  });
});

describe("invites.listReceived", () => {
  it("GET /v1/invites/received returns received invitation page", async () => {
    server.use(
      http.get(`${BASE}/v1/invites/received`, () =>
        HttpResponse.json({ object: "invitation_list", items: [], cursor: null }),
      ),
    );
    const res = await acc.invites.listReceived();
    expect(Array.isArray(res.items)).toBe(true);
  });
});

describe("invites.respond", () => {
  it("POST /v1/invites/received/:invitation_id returns result", async () => {
    server.use(
      http.post(`${BASE}/v1/invites/received/inv_1`, () =>
        HttpResponse.json({ object: "invitation_handled", invitation_id: "inv_1", action: "accept", status: "accepted" }),
      ),
    );
    // respond requires: account_id, action, shared_secret
    const res = await acc.invites.respond("inv_1", {
      account_id: "acc_1",
      action: "accept",
      shared_secret: "secret_tok_1",
    });
    expect(res.status).toBe("accepted");
  });
});

describe("invites.cancel", () => {
  it("DELETE /v1/invites/:invitation_id returns cancelled result", async () => {
    server.use(
      http.delete(`${BASE}/v1/invites/inv_1`, () =>
        HttpResponse.json({ object: "invitation_canceled", invitation_id: "inv_1", status: "canceled" }),
      ),
    );
    const res = await acc.invites.cancel("inv_1");
    expect(res.invitation_id).toBe("inv_1");
  });
});
