// jobs namespace (1 method, account-scoped)
// TDD: URL-vs-id parity, typed return, and client-side validation on a
// job identifier the SDK cannot resolve to a numeric id.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";
import { CurviateError, isCurviateError } from "../src/errors.js";

const BASE = "https://app.curviate.test";
const ACC = "acc_jobs1";
const client = new Curviate({ apiKey: "cvt_test_jobs", baseUrl: BASE });
const jobs = () => client.account(ACC).jobs;

const JOB_FIXTURE = {
  object: "job_posting",
  id: "4428113858",
  title: "Founders Associate",
  company: "LEAGUES",
  company_id: "67756343",
  state: "active",
  location: "Stuttgart, Baden-Württemberg, Germany",
  cost: 0,
  applicants_counter: 75,
  description: "Über deine Rolle: …",
  created_at: "2026-06-12T10:07:09.000Z",
  published_at: "2026-06-12T10:08:03.000Z",
  hiring_team: [] as unknown[],
};

describe("jobs.get", () => {
  it("GET /v1/jobs/:job_id — a bare numeric id issues the request as-is", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/jobs/4428113858`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(JOB_FIXTURE);
      }),
    );
    const res = await jobs().get("4428113858");
    expect(capturedUrl).toBeDefined();
    expect(new URL(capturedUrl!).pathname).toBe("/v1/jobs/4428113858");
    expect(res.object).toBe("job_posting");
    expect(res.id).toBe("4428113858");
    expect(res.title).toBe("Founders Associate");
    expect(res.company).toBe("LEAGUES");
    expect(res.company_id).toBe("67756343");
    expect(res.applicants_counter).toBe(75);
    expect(res.hiring_team).toEqual([]);
  });

  it("a full LinkedIn job URL resolves client-side to the identical GET /v1/jobs/4428113858 request", async () => {
    let capturedUrl: string | undefined;
    let hitCount = 0;
    server.use(
      http.get(`${BASE}/v1/jobs/4428113858`, ({ request }) => {
        hitCount++;
        capturedUrl = request.url;
        return HttpResponse.json(JOB_FIXTURE);
      }),
    );
    const byId = await jobs().get("4428113858");
    const byUrl = await jobs().get("https://www.linkedin.com/jobs/view/4428113858");
    expect(hitCount).toBe(2);
    expect(new URL(capturedUrl!).pathname).toBe("/v1/jobs/4428113858");
    expect(byUrl).toEqual(byId);
  });

  it("extracts the id from a job URL carrying a trailing slash and query string", async () => {
    server.use(
      http.get(`${BASE}/v1/jobs/4428113858`, () => HttpResponse.json(JOB_FIXTURE)),
    );
    const res = await jobs().get(
      "https://www.linkedin.com/jobs/view/4428113858/?refId=abc123&trackingId=xyz",
    );
    expect(res.id).toBe("4428113858");
  });

  it("throws INVALID_REQUEST synchronously for a value with no extractable numeric id", () => {
    let caught: unknown;
    try {
      jobs().get("https://www.linkedin.com/jobs/view/not-a-number");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
  });

  it("throws INVALID_REQUEST synchronously for an unrelated non-numeric string", () => {
    let caught: unknown;
    try {
      jobs().get("not-a-job-identifier");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
  });
});
