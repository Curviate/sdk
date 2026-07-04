// profiles namespace (8 methods, account-scoped) — getCompany removed, hard-moved to companies.get()
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

  it("forwards linkedin_sections as a repeated query param", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/profiles/me`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ object: "own_profile", provider_id: "ACoABC", first_name: "Alice", last_name: "Smith" });
      }),
    );
    await acc.profiles.getMe({ linkedin_sections: ["about", "experience"] });
    const params = new URL(url!).searchParams;
    // repeated param — getAll returns an array
    expect(params.getAll("linkedin_sections")).toEqual(["about", "experience"]);
  });

  it("OwnProfile response carries is_premium and is_open_profile (not premium / open_profile)", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/me`, () =>
        HttpResponse.json({
          object: "own_profile",
          provider_id: "ACoABC",
          first_name: "Alice",
          last_name: "Smith",
          is_premium: true,
          is_open_profile: false,
        }),
      ),
    );
    const res = await acc.profiles.getMe();
    // is_premium / is_open_profile are the canonical field names
    expect(res.is_premium).toBe(true);
    expect(res.is_open_profile).toBe(false);
    // old names must NOT be typed (TypeScript would catch this at typecheck, runtime check here)
    expect((res as Record<string, unknown>)["premium"]).toBeUndefined();
    expect((res as Record<string, unknown>)["open_profile"]).toBeUndefined();
  });

  it("OwnProfile carries optional enriched fields when linkedin_sections supplied", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/me`, () =>
        HttpResponse.json({
          object: "own_profile",
          provider_id: "ACoABC",
          first_name: "Alice",
          last_name: "Smith",
          follower_count: 1200,
          connections_count: 500,
          summary: "AI engineer",
          work_experience: [{ title: "Engineer" }],
          education: [{ school: "MIT" }],
          skills: ["TypeScript"],
          throttled_sections: [],
        }),
      ),
    );
    const res = await acc.profiles.getMe({ linkedin_sections: ["*"] });
    expect(res.follower_count).toBe(1200);
    expect(res.connections_count).toBe(500);
    expect(res.summary).toBe("AI engineer");
    expect(Array.isArray(res.work_experience)).toBe(true);
    expect(Array.isArray(res.education)).toBe(true);
    expect(res.skills).toContain("TypeScript");
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
