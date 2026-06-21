// sdk/004 — HTTP transport: serialisation, parsing, retry, backoff, rate-limit,
// timeout, multipart, binary. MSW is the fast (Docker-free) seam.
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "./msw/server.js";
import { execute } from "../src/transport.js";
import { CurviateError, isCurviateError } from "../src/errors.js";

const BASE = "https://app.curviate.test";

/** Common transport options for deterministic tests: no jitter, no real delay. */
function det(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: "k",
    baseUrl: BASE,
    timeout: 30_000,
    maxRetries: 3,
    _jitterFn: () => 0,
    _sleepFn: vi.fn(async () => {}), // never actually waits
    ...overrides,
  };
}

describe("request serialisation (FR-001, FR-002)", () => {
  // TS-001 (AC-001) — GET: no body, auth header present, no content-type.
  it("GET sends no body, an Authorization header, and no Content-Type", async () => {
    let captured: Request | undefined;
    server.use(
      http.get(`${BASE}/v1/accounts`, ({ request }) => {
        captured = request.clone();
        return HttpResponse.json({ items: [] });
      }),
    );
    await execute("GET", "/v1/accounts", det({ apiKey: "secret_k" }));
    expect(captured?.method).toBe("GET");
    expect(captured?.headers.get("authorization")).toBe("Bearer secret_k");
    expect(captured?.headers.get("content-type")).toBeNull();
  });

  // TS-002 (AC-002) — POST JSON: content-type + JSON.stringify body.
  it("POST JSON sets application/json and stringifies the body", async () => {
    let body: unknown;
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/accounts/link`, async ({ request }) => {
        ct = request.headers.get("content-type");
        body = await request.json();
        return HttpResponse.json({ id: "acc_1" });
      }),
    );
    await execute("POST", "/v1/accounts/link", det({ body: { username: "u" } }));
    expect(ct).toBe("application/json");
    expect(body).toEqual({ username: "u" });
  });

  // TS-003 (AC-003) — POST FormData: multipart content-type, no JSON.
  it("POST FormData omits Content-Type so the runtime sets the boundary", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/chats`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json({ id: "c1" });
      }),
    );
    const fd = new FormData();
    fd.append("text", "hi");
    await execute("POST", "/v1/chats", det({ body: fd }));
    expect(ct).toMatch(/^multipart\/form-data/);
    expect(ct).not.toContain("application/json");
  });

  // FR-001 — GET query params appended via URLSearchParams.
  it("GET appends query params to the URL", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${BASE}/v1/chats`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ items: [] });
      }),
    );
    await execute("GET", "/v1/chats", det({ query: { account_id: "acc_123", limit: 10 } }));
    const parsed = new URL(url!);
    expect(parsed.searchParams.get("account_id")).toBe("acc_123");
    expect(parsed.searchParams.get("limit")).toBe("10");
  });
});

describe("response parsing (FR-003)", () => {
  // TS-004 (AC-004) — JSON success.
  it("parses a 200 application/json response", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () => HttpResponse.json({ items: [{ id: "a" }] })),
    );
    const out = await execute<{ items: { id: string }[] }>("GET", "/v1/accounts", det());
    expect(out.items[0]!.id).toBe("a");
  });

  // TS-004 (AC-005) — binary octet-stream → ArrayBuffer.
  it("returns an ArrayBuffer for application/octet-stream", async () => {
    server.use(
      http.get(`${BASE}/v1/messages/m1/attachments/a1`, () =>
        HttpResponse.arrayBuffer(new Uint8Array([1, 2, 3]).buffer, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      ),
    );
    const out = await execute<ArrayBuffer>(
      "GET",
      "/v1/messages/m1/attachments/a1",
      det(),
    );
    expect(out).toBeInstanceOf(ArrayBuffer);
    expect(out.byteLength).toBe(3);
  });
});

describe("error mapping (FR-003)", () => {
  // TS-005 (AC-006) — 401 maps to CurviateError with code + httpStatus.
  it("maps a 401 error envelope to CurviateError", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json(
          {
            code: "UNAUTHORIZED",
            message: "Invalid key.",
            user_fixable: false,
            retry_likely_to_succeed: false,
          },
          { status: 401 },
        ),
      ),
    );
    const err = await execute("GET", "/v1/accounts", det({ maxRetries: 0 })).catch((e) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("UNAUTHORIZED");
    expect((err as CurviateError).httpStatus).toBe(401);
    expect((err as CurviateError).userFixable).toBe(false);
  });

  // AC-007 — 500 with non-JSON body → INTERNAL.
  it("wraps a 500 non-JSON body as INTERNAL", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        new HttpResponse("upstream blew up", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const err = await execute("GET", "/v1/accounts", det({ maxRetries: 0 })).catch((e) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("INTERNAL");
    expect((err as CurviateError).httpStatus).toBe(500);
  });

  // AC-008 — network failure → INTERNAL with undefined httpStatus.
  it("wraps a fetch network failure as INTERNAL with undefined httpStatus", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () => HttpResponse.error()),
    );
    const err = await execute("GET", "/v1/accounts", det({ maxRetries: 0 })).catch((e) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("INTERNAL");
    expect((err as CurviateError).httpStatus).toBeUndefined();
  });

  // Hard Rule #2 — the apiKey never appears in a thrown/ serialized transport error.
  it("never leaks the apiKey in a thrown error (Hard Rule #2)", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json(
          { code: "UNAUTHORIZED", message: "no", user_fixable: false, retry_likely_to_succeed: false },
          { status: 401 },
        ),
      ),
    );
    const err = await execute("GET", "/v1/accounts", det({ apiKey: "super_secret_key", maxRetries: 0 })).catch(
      (e) => e,
    );
    const serialized = JSON.stringify(err);
    expect(serialized).not.toContain("super_secret_key");
    expect(serialized).not.toContain("Bearer");
  });
});

describe("retry logic (FR-004)", () => {
  // TS-006 (AC-009) — GET retries on 500 then succeeds; exactly 3 fetches.
  it("retries a GET on 500 and returns the eventual 200 (3 fetches)", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/accounts`, () => {
        calls += 1;
        if (calls < 3) {
          return HttpResponse.json(
            { code: "INTERNAL", message: "x", user_fixable: false, retry_likely_to_succeed: true },
            { status: 500 },
          );
        }
        return HttpResponse.json({ items: [] });
      }),
    );
    const out = await execute<{ items: unknown[] }>("GET", "/v1/accounts", det());
    expect(out.items).toEqual([]);
    expect(calls).toBe(3);
  });

  // TS-006 (AC-010) — POST is NOT auto-retried; exactly 1 fetch.
  it("does not retry a POST on 500 (1 fetch, throws)", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/v1/accounts/link`, () => {
        calls += 1;
        return HttpResponse.json(
          { code: "INTERNAL", message: "x", user_fixable: false, retry_likely_to_succeed: true },
          { status: 500 },
        );
      }),
    );
    const err = await execute("POST", "/v1/accounts/link", det({ body: {} })).catch((e) => e);
    expect(isCurviateError(err)).toBe(true);
    expect(calls).toBe(1);
  });

  // FR-004 exception — a write that gets 429 + Retry-After waits the delay but
  // does NOT re-fire; it throws with the retry-after surfaced (1 fetch).
  it("waits the Retry-After on a 429 write but does not re-fire it", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    server.use(
      http.post(`${BASE}/v1/accounts/link`, () => {
        calls += 1;
        return HttpResponse.json(
          { code: "RATE_LIMIT_ACCOUNT", message: "slow", user_fixable: false, retry_likely_to_succeed: true },
          { status: 429, headers: { "Retry-After": "7" } },
        );
      }),
    );
    const err = await execute("POST", "/v1/accounts/link", det({
      body: {},
      _sleepFn: async (ms: number) => {
        sleeps.push(ms);
      },
    })).catch((e) => e);
    expect(calls).toBe(1); // never re-fired the write
    expect(sleeps).toEqual([7_000]); // but waited the Retry-After
    expect((err as CurviateError).retryAfterMs).toBe(7_000);
    expect((err as CurviateError).retryLikelyToSucceed).toBe(true);
  });

  // FR-004 — a non-retryable code (404) on a GET throws immediately (1 fetch).
  it("does not retry a non-retryable GET error (404, 1 fetch)", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/accounts/x`, () => {
        calls += 1;
        return HttpResponse.json(
          { code: "ACCOUNT_NOT_FOUND", message: "no", user_fixable: true, retry_likely_to_succeed: false },
          { status: 404 },
        );
      }),
    );
    await execute("GET", "/v1/accounts/x", det()).catch(() => {});
    expect(calls).toBe(1);
  });
});

describe("backoff computation (FR-005)", () => {
  // TS-007 (AC-011) — deterministic backoff sequence [500, 1000, 2000] with jitter=0.
  it("computes exponential backoff 500/1000/2000 with jitter disabled", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/accounts`, () => {
        calls += 1;
        if (calls <= 3) {
          return HttpResponse.json(
            { code: "INTERNAL", message: "x", user_fixable: false, retry_likely_to_succeed: true },
            { status: 500 },
          );
        }
        return HttpResponse.json({ items: [] });
      }),
    );
    await execute("GET", "/v1/accounts", det({
      maxRetries: 3,
      _jitterFn: () => 0,
      _sleepFn: async (ms: number) => {
        sleeps.push(ms);
      },
    })).catch(() => {});
    expect(sleeps).toEqual([500, 1000, 2000]);
  });

  // TS-008 (AC-012) — Retry-After header overrides the backoff formula.
  it("Retry-After header overrides the backoff delay", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/accounts`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { code: "RATE_LIMIT_ACCOUNT", message: "slow", user_fixable: false, retry_likely_to_succeed: true },
            { status: 429, headers: { "Retry-After": "42" } },
          );
        }
        return HttpResponse.json({ items: [] });
      }),
    );
    await execute("GET", "/v1/accounts", det({
      _jitterFn: () => 0,
      _sleepFn: async (ms: number) => {
        sleeps.push(ms);
      },
    }));
    expect(sleeps[0]).toBe(42_000);
  });

  // AC-013 — retry_hint.delay_ms overrides backoff (but Retry-After beats it).
  it("retry_hint.delay_ms overrides the backoff delay", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    server.use(
      http.get(`${BASE}/v1/accounts`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            {
              code: "PLATFORM_RATE_LIMIT",
              message: "cool down",
              retry_hint: { kind: "delay", delay_ms: 5000 },
              user_fixable: false,
              retry_likely_to_succeed: true,
            },
            { status: 429 },
          );
        }
        return HttpResponse.json({ items: [] });
      }),
    );
    await execute("GET", "/v1/accounts", det({
      _jitterFn: () => 0,
      _sleepFn: async (ms: number) => {
        sleeps.push(ms);
      },
    }));
    expect(sleeps[0]).toBe(5000);
  });
});

describe("rate-limit surfacing (FR-007)", () => {
  // TS-010 (AC-015) — retryAfterMs populated on a 429 error.
  it("populates retryAfterMs from Retry-After on a thrown 429", async () => {
    server.use(
      http.get(`${BASE}/v1/accounts`, () =>
        HttpResponse.json(
          { code: "RATE_LIMIT_ACCOUNT", message: "slow", user_fixable: false, retry_likely_to_succeed: true },
          { status: 429, headers: { "Retry-After": "10" } },
        ),
      ),
    );
    const err = await execute("GET", "/v1/accounts", det({ maxRetries: 0 })).catch((e) => e);
    expect((err as CurviateError).retryAfterMs).toBe(10_000);
  });
});

describe("timeout (FR-006)", () => {
  // TS-009 (AC-014) — per-attempt timeout fires AbortError → INTERNAL 'timed out'.
  it("aborts and throws INTERNAL 'timed out' when the request exceeds timeout", async () => {
    server.use(
      http.get(`${BASE}/v1/slow`, async () => {
        await new Promise((r) => setTimeout(r, 5_000));
        return HttpResponse.json({ ok: true });
      }),
    );
    // Real timers here: a 50ms timeout vs a 5s handler. Uses the real sleep so
    // the AbortController actually fires; no retry so the test stays fast.
    const err = await execute("GET", "/v1/slow", {
      apiKey: "k",
      baseUrl: BASE,
      timeout: 50,
      maxRetries: 0,
    }).catch((e) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("INTERNAL");
    expect((err as CurviateError).message.toLowerCase()).toContain("timed out");
  });
});
