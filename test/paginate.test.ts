// sdk/002 FR-003 — paginate cursor helper (TS-004, TS-005)
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";

const BASE = "https://app.curviate.test";

describe("curviate.paginate", () => {
  // TS-004 (AC-005): follows cursor across pages, stops on null
  it("yields all items across two pages, stops on null cursor", async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/v1/profiles/relations`, ({ request }) => {
        callCount++;
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (!cursor) {
          return HttpResponse.json({ items: [{ profile_id: "c_1" }, { profile_id: "c_2" }], cursor: "page2" });
        }
        return HttpResponse.json({ items: [{ profile_id: "c_3" }], cursor: null });
      }),
    );

    const curviate = new Curviate({ apiKey: "k", baseUrl: BASE });
    const scoped = curviate.account("acc_1");
    const items: { profile_id?: string }[] = [];
    for await (const item of curviate.paginate(scoped.profiles.listConnections.bind(scoped.profiles), {})) {
      items.push(item as { profile_id?: string });
    }

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ profile_id: "c_1" });
    expect(items[2]).toMatchObject({ profile_id: "c_3" });
    expect(callCount).toBe(2);
  });

  // TS-005 (AC-005): stops immediately on a single-page response with cursor:null
  it("stops immediately if first page has null cursor", async () => {
    server.use(
      http.get(`${BASE}/v1/profiles/relations`, () =>
        HttpResponse.json({ items: [{ profile_id: "only" }], cursor: null }),
      ),
    );

    const curviate = new Curviate({ apiKey: "k", baseUrl: BASE });
    const scoped = curviate.account("acc_1");
    const items: unknown[] = [];
    for await (const item of curviate.paginate(scoped.profiles.listConnections.bind(scoped.profiles), {})) {
      items.push(item);
    }
    expect(items).toHaveLength(1);
  });

  // paginate works with POST methods that accept a body (e.g. search.people) — uses cursor field in response
  it("follows cursor for POST paginated methods", async () => {
    let callCount = 0;
    server.use(
      http.post(`${BASE}/v1/search/people`, async ({ request }) => {
        callCount++;
        const url = new URL(request.url);
        const cursor = url.searchParams.get("cursor");
        if (!cursor) {
          return HttpResponse.json({ object: "people_search_result", items: [{ linkedin_urn: "s_1", public_identifier: "s1", full_name: "Alice", headline: null, location: null, avatar_url: null, network_distance: null }, { linkedin_urn: "s_2", public_identifier: "s2", full_name: "Bob", headline: null, location: null, avatar_url: null, network_distance: null }], config: { params: {} }, paging: { start: 0, page_count: 2, total_count: 3 }, cursor: "page2" });
        }
        return HttpResponse.json({ object: "people_search_result", items: [{ linkedin_urn: "s_3", public_identifier: "s3", full_name: "Carol", headline: null, location: null, avatar_url: null, network_distance: null }], config: { params: {} }, paging: { start: 10, page_count: 2, total_count: 3 }, cursor: null });
      }),
    );

    const curviate = new Curviate({ apiKey: "k", baseUrl: BASE });
    const scoped = curviate.account("acc_1");
    const items: unknown[] = [];
    for await (const item of curviate.paginate(scoped.search.people.bind(scoped.search), { keywords: "engineer" })) {
      items.push(item);
    }
    expect(items).toHaveLength(3);
    expect(callCount).toBe(2);
  });
});
