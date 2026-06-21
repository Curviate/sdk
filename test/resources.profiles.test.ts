// sdk/002 — profiles namespace (9 methods, account-scoped)
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";
const acc = new Curviate({ apiKey: "cvt_test_prof", baseUrl: BASE }).account("acc_1");

describe("profiles.getMe", () => {
  it("GET /v1/profiles/me returns own profile", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/me`, () =>
        // own_profile has first_name / last_name / provider_id (not full_name)
        HttpResponse.json({ object: "own_profile", provider_id: "ACoABC", first_name: "Alice", last_name: "Smith" }),
      ),
    );
    const res = await acc.profiles.getMe();
    expect(res.first_name).toBe("Alice");
  });
});

describe("profiles.get", () => {
  it("GET /v1/profiles/:profile_id returns profile", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/prof_1`, () =>
        // profile has provider_id, public_identifier (not profile_id)
        HttpResponse.json({ object: "profile", provider_id: "ACoABC", public_identifier: "prof_1" }),
      ),
    );
    const res = await acc.profiles.get("prof_1");
    expect(res.public_identifier).toBe("prof_1");
  });

  it("forwards notify=true query param", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/profiles/prof_1`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "profile", provider_id: "ACoABC" });
      }),
    );
    // notify is optional; account_id is injected by context
    await acc.profiles.get("prof_1", { notify: true });
    expect(new URL(url!).searchParams.get("notify")).toBe("true");
  });
});

describe("profiles.listConnections", () => {
  it("GET /v1/profiles/relations returns connection list page", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/relations`, () =>
        // relation items have first_name, public_identifier (not profile_id)
        HttpResponse.json({ object: "relation_list", items: [{ first_name: "Bob", public_identifier: "bob-smith" }], cursor: null }),
      ),
    );
    const res = await acc.profiles.listConnections();
    expect(res.items?.[0]?.first_name).toBe("Bob");
  });
});

describe("profiles.listFollowers", () => {
  it("GET /v1/profiles/:profile_id/followers returns follower page", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/prof_1/followers`, () =>
        HttpResponse.json({ object: "profile_list", items: [], cursor: null }),
      ),
    );
    const res = await acc.profiles.listFollowers("prof_1");
    expect(Array.isArray(res.items)).toBe(true);
  });
});

describe("profiles.listPosts", () => {
  it("GET /v1/profiles/:profile_id/posts returns post page", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/prof_1/posts`, () =>
        // profile post items have 'id' and 'text' (not post_id)
        HttpResponse.json({ object: "post_list", items: [{ id: "p_1", text: "hi" }], cursor: null }),
      ),
    );
    const res = await acc.profiles.listPosts("prof_1");
    expect(res.items?.[0]?.id).toBe("p_1");
  });
});

describe("profiles.listComments", () => {
  it("GET /v1/profiles/:profile_id/comments returns comment page", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/prof_1/comments`, () =>
        HttpResponse.json({ object: "comment_list", items: [], cursor: null }),
      ),
    );
    const res = await acc.profiles.listComments("prof_1");
    expect(Array.isArray(res.items)).toBe(true);
  });
});

describe("profiles.listReactions", () => {
  it("GET /v1/profiles/:profile_id/reactions returns reaction page", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/prof_1/reactions`, () =>
        HttpResponse.json({ object: "reaction_list", items: [], cursor: null }),
      ),
    );
    const res = await acc.profiles.listReactions("prof_1");
    expect(Array.isArray(res.items)).toBe(true);
  });
});

describe("profiles.getCompany", () => {
  it("GET /v1/profiles/companies/:company_id returns company profile", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/companies/co_1`, () =>
        HttpResponse.json({ object: "company", name: "Acme" }),
      ),
    );
    const res = await acc.profiles.getCompany("co_1");
    expect(res.name).toBe("Acme");
  });
});

describe("profiles.endorse", () => {
  it("POST /v1/profiles/:profile_id/endorse returns endorsement result", async () => {
    server.use(
      http.post(`${BASE}/v1/profiles/prof_1/endorse`, () =>
        // endorse returns { object: "profile_endorsed", endorsed: boolean }
        HttpResponse.json({ object: "profile_endorsed", endorsed: true }),
      ),
    );
    // skill_endorsement_id is a number per the OpenAPI schema
    const res = await acc.profiles.endorse("prof_1", { account_id: "acc_1", skill_endorsement_id: 12345 });
    expect(res.endorsed).toBe(true);
  });
});
