// recruiter namespace (23 methods, account-scoped) — project-centric rebuild.
// account-first grammar (account_id is the leading /v1/ path segment, never
// query/body). startChat is JSON-only (signature + subject REQUIRED, base64
// attachments in-body, no multipart). searchParameters is POST with a
// source-discriminated oneOf body. createJob opens a new project
// (project_name required); createProjectJob omits it (project in path).
// publishJob's body is a mode-discriminated oneOf; closeJob is bodyless.
// searchTalentPool / listApplicants require channel_id. POST-as-search reads
// keep limit/cursor/offset as top-level query params. downloadResume returns
// raw bytes. Removed: syncMessages, addApplicant, rejectApplicant,
// solveJobCheckpoint; addCandidate renamed to saveCandidate.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";
import { CurviateError, isCurviateError } from "../../src/errors.js";

const BASE = "https://app.curviate.test";
const ACC = "acc_rec1";
const client = new Curviate({ apiKey: "cvt_test_recruiter", baseUrl: BASE });
const rec = () => client.account(ACC).recruiter;

// A createJob body that compiles against the generated request-body type:
// job_title is an object {id,name} (both required), company is the {name} arm
// of its oneOf, industry/job_function are arrays, apply_method is the
// method-discriminated object. project_name is REQUIRED (opens a new project).
const CREATE_JOB_BODY = {
  project_name: "P",
  job_title: { id: "title_1", name: "Eng" },
  company: { name: "Acme" },
  workplace_type: "REMOTE" as const,
  location: "l",
  employment_status: "FULL_TIME" as const,
  seniority_level: "MID_SENIOR_LEVEL" as const,
  description: "d".repeat(200),
  industry: ["4"],
  job_function: ["eng"],
  apply_method: { method: "linkedin" as const, notification_email: "jobs@acme.test" },
};

describe("recruiter.getProfile", () => {
  it("GET /v1/{account_id}/recruiter/profiles/{identifier} — account-first, with_sections repeats", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/profiles/ACo1`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          object: "recruiter_profile",
          id: "ACo1",
          type: "individual",
          display_name: "Alice",
          provider: "linkedin",
          recruiting_profile: {},
        });
      }),
    );
    const res = await rec().getProfile("ACo1", { with_sections: ["linkedin_skills", "linkedin_education"] });
    const url = new URL(capturedUrl!);
    expect(url.pathname).toBe(`/v1/${ACC}/recruiter/profiles/ACo1`);
    expect(url.searchParams.getAll("with_sections")).toEqual(["linkedin_skills", "linkedin_education"]);
    expect(url.searchParams.has("account_id")).toBe(false);
    expect(res.object).toBe("recruiter_profile");
  });
});

describe("recruiter.startChat", () => {
  it("POST /v1/{account_id}/recruiter/chats — JSON body carries the required signature/subject", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/chats`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { object: "chat_started", chat_id: "chat_1", message_id: "msg_1" },
          { status: 201 },
        );
      }),
    );
    const res = await rec().startChat({
      attendees_ids: ["AEo1"],
      text: "hi",
      subject: "Opportunity",
      signature: "— Alice",
    });
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/chats`);
    expect(body).toEqual({ attendees_ids: ["AEo1"], text: "hi", subject: "Opportunity", signature: "— Alice" });
    expect(body?.signature).toBe("— Alice");
    expect(res.chat_id).toBe("chat_1");
  });
});

describe("recruiter.searchPeople", () => {
  it("POST .../recruiter/search/people — limit/cursor stay top-level query", async () => {
    let capturedUrl: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/search/people`, async ({ request }) => {
        capturedUrl = request.url;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_people_search_result", data: [], cursor: null });
      }),
    );
    await rec().searchPeople({ keywords: "eng" }, { limit: 25, cursor: "cur_1" });
    const url = new URL(capturedUrl!);
    expect(url.pathname).toBe(`/v1/${ACC}/recruiter/search/people`);
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("cursor")).toBe("cur_1");
    expect(body).toEqual({ keywords: "eng" });
  });
});

describe("recruiter.searchParameters", () => {
  // The method is a POST (never GET); the body is the source-discriminated oneOf.
  it("POST .../recruiter/search/parameters with {source,type} — not GET", async () => {
    let method: string | undefined;
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/search/parameters`, async ({ request }) => {
        method = request.method;
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_search_parameter_list", data: [] });
      }),
    );
    const res = await rec().searchParameters({ source: "SEARCH", type: "JOB_TITLE" });
    expect(method).toBe("POST");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/search/parameters`);
    expect(body).toEqual({ source: "SEARCH", type: "JOB_TITLE" });
    expect(res.object).toBe("recruiter_search_parameter_list");
  });

  it("carries project_id on the APPLICANTS source arm", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/search/parameters`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_search_parameter_list", data: [] });
      }),
    );
    await rec().searchParameters({ source: "APPLICANTS", project_id: "proj_1", type: "SKILL" });
    expect(body).toEqual({ source: "APPLICANTS", project_id: "proj_1", type: "SKILL" });
  });
});

describe("recruiter.searchTalentPool", () => {
  it("POST .../projects/{project_id}/talent-pool/search — channel_id required in body", async () => {
    let seenPath: string | undefined;
    let capturedUrl: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/talent-pool/search`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        capturedUrl = request.url;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "recruiter_people_search_result", data: [], cursor: null });
      }),
    );
    await rec().searchTalentPool("proj_1", { channel_id: "chan_1", keywords: "eng" }, { limit: 10 });
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/talent-pool/search`);
    expect(new URL(capturedUrl!).searchParams.get("limit")).toBe("10");
    expect(body).toEqual({ channel_id: "chan_1", keywords: "eng" });
    expect(body?.channel_id).toBe("chan_1");
  });
});

describe("recruiter.searchFromUrl", () => {
  it("POST .../recruiter/search — body is {url}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/search`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_people_search_result", data: [], cursor: null });
      }),
    );
    await rec().searchFromUrl({ url: "https://www.linkedin.com/talent/search" });
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/search`);
    expect(body).toEqual({ url: "https://www.linkedin.com/talent/search" });
  });
});

describe("recruiter.listProjects", () => {
  it("GET .../recruiter/projects — status is a repeated query param", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/projects`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "recruiter_project_list", data: [], cursor: null });
      }),
    );
    await rec().listProjects({ status: ["ACTIVE"], limit: 5 });
    const params = new URL(capturedUrl!).searchParams;
    expect(new URL(capturedUrl!).pathname).toBe(`/v1/${ACC}/recruiter/projects`);
    expect(params.getAll("status")).toEqual(["ACTIVE"]);
    expect(params.get("limit")).toBe("5");
  });
});

describe("recruiter.getProject", () => {
  it("GET .../recruiter/projects/{project_id}", async () => {
    let seenPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/projects/proj_1`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json({ object: "recruiter_project", id: "proj_1" });
      }),
    );
    const res = await rec().getProject("proj_1");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1`);
    expect(res.object).toBe("recruiter_project");
  });
});

describe("recruiter.updateProject", () => {
  it("PATCH .../recruiter/projects/{project_id} sends only the included fields", async () => {
    let method: string | undefined;
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.patch(`${BASE}/v1/${ACC}/recruiter/projects/proj_1`, async ({ request }) => {
        method = request.method;
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_project_edited" });
      }),
    );
    const res = await rec().updateProject("proj_1", { name: "Renamed", visibility: "PRIVATE" });
    expect(method).toBe("PATCH");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1`);
    expect(body).toEqual({ name: "Renamed", visibility: "PRIVATE" });
    expect(res.object).toBe("recruiter_project_edited");
  });
});

describe("recruiter.listPipeline", () => {
  it("POST .../projects/{project_id}/pipeline — filter body, limit/cursor top-level query", async () => {
    let seenPath: string | undefined;
    let capturedUrl: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/pipeline`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        capturedUrl = request.url;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_pipeline_candidate_list", data: [], cursor: null });
      }),
    );
    await rec().listPipeline("proj_1", { stage_id: "stage_1" }, { limit: 50, cursor: "cur_2" });
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/pipeline`);
    const params = new URL(capturedUrl!).searchParams;
    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cur_2");
    expect(body).toEqual({ stage_id: "stage_1" });
  });

  it("defaults to an empty filter body when none is supplied", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/pipeline`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_pipeline_candidate_list", data: [], cursor: null });
      }),
    );
    await rec().listPipeline("proj_1");
    expect(body).toEqual({});
  });
});

describe("recruiter.listProjectJobs", () => {
  it("GET .../projects/{project_id}/jobs — returns the single attached posting", async () => {
    let seenPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json({ object: "recruiter_job_posting", id: "job_1", project_id: "proj_1" });
      }),
    );
    const res = await rec().listProjectJobs("proj_1");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/jobs`);
    expect(res.object).toBe("recruiter_job_posting");
  });
});

describe("recruiter.createProjectJob", () => {
  it("POST .../projects/{project_id}/jobs — body carries NO project_name (project is in the path)", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "recruiter_job_posting_created", job_id: "job_1", project_id: "proj_1" }, { status: 201 });
      }),
    );
    const { project_name: _drop, ...projectJobBody } = CREATE_JOB_BODY;
    const res = await rec().createProjectJob("proj_1", projectJobBody);
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/jobs`);
    expect(body).not.toHaveProperty("project_name");
    expect(body?.job_title).toEqual({ id: "title_1", name: "Eng" });
    expect(res.project_id).toBe("proj_1");
  });
});

describe("recruiter.getProjectJobBudget", () => {
  it("GET .../projects/{project_id}/jobs/{job_id}/budget", async () => {
    let seenPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/budget`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json({ object: "recruiter_job_posting_budget" });
      }),
    );
    const res = await rec().getProjectJobBudget("proj_1", "job_1");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/budget`);
    expect(res.object).toBe("recruiter_job_posting_budget");
  });
});

describe("recruiter.createJob", () => {
  // project_name required; job_title/company objects; industry/job_function
  // arrays; apply_method method-discriminated object.
  it("POST .../recruiter/jobs — includes project_name; job_title/company/apply_method are objects", async () => {
    let seenPath: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/jobs`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "recruiter_job_posting_created", job_id: "job_1", project_id: "proj_new" }, { status: 201 });
      }),
    );
    const res = await rec().createJob(CREATE_JOB_BODY);
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/jobs`);
    expect(body).toEqual(CREATE_JOB_BODY);
    expect(body?.project_name).toBe("P");
    expect(body?.job_title).toEqual({ id: "title_1", name: "Eng" });
    expect(body?.company).toEqual({ name: "Acme" });
    expect(body?.industry).toEqual(["4"]);
    expect(body?.job_function).toEqual(["eng"]);
    expect(body?.apply_method).toEqual({ method: "linkedin", notification_email: "jobs@acme.test" });
    expect(res.object).toBe("recruiter_job_posting_created");
  });
});

describe("recruiter.listJobs", () => {
  it("GET .../recruiter/jobs — state is a repeated query param", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/jobs`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ object: "recruiter_job_posting_list", data: [], cursor: null });
      }),
    );
    await rec().listJobs({ state: ["OPEN"], limit: 5 });
    const params = new URL(capturedUrl!).searchParams;
    expect(new URL(capturedUrl!).pathname).toBe(`/v1/${ACC}/recruiter/jobs`);
    expect(params.getAll("state")).toEqual(["OPEN"]);
    expect(params.get("limit")).toBe("5");
  });
});

describe("recruiter.getJob", () => {
  it("GET .../recruiter/jobs/{job_id} — a bare numeric id issues the request as-is", async () => {
    let seenPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/jobs/4428113858`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json({ object: "recruiter_job_posting", id: "4428113858", project_id: "proj_1" });
      }),
    );
    const res = await rec().getJob("4428113858");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/jobs/4428113858`);
    expect(res.object).toBe("recruiter_job_posting");
  });

  it("a full LinkedIn job URL resolves client-side to the identical GET request", async () => {
    let hitCount = 0;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/jobs/4428113858`, () => {
        hitCount++;
        return HttpResponse.json({ object: "recruiter_job_posting", id: "4428113858", project_id: "proj_1" });
      }),
    );
    const byId = await rec().getJob("4428113858");
    const byUrl = await rec().getJob("https://www.linkedin.com/jobs/view/4428113858");
    expect(hitCount).toBe(2);
    expect(byUrl).toEqual(byId);
  });

  it("throws INVALID_REQUEST synchronously for an unrelated non-numeric string", () => {
    let caught: unknown;
    try {
      rec().getJob("not-a-job-identifier");
    } catch (e) {
      caught = e;
    }
    expect(isCurviateError(caught)).toBe(true);
    expect((caught as CurviateError).code).toBe("INVALID_REQUEST");
  });
});

describe("recruiter.updateProjectJob", () => {
  it("PATCH .../projects/{project_id}/jobs/{job_id} sends only the included fields", async () => {
    let method: string | undefined;
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.patch(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1`, async ({ request }) => {
        method = request.method;
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_job_posting", id: "job_1", project_id: "proj_1" });
      }),
    );
    await rec().updateProjectJob("proj_1", "job_1", { description: "d".repeat(200) });
    expect(method).toBe("PATCH");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1`);
    expect(body).toEqual({ description: "d".repeat(200) });
  });
});

describe("recruiter.publishJob", () => {
  it("POST .../projects/{project_id}/jobs/{job_id}/publish with mode:'FREE' sends {mode:'FREE'}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/publish`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_job_posting_published", job_state: "LISTED" });
      }),
    );
    const res = await rec().publishJob("proj_1", "job_1", { mode: "FREE" });
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/publish`);
    expect(body).toEqual({ mode: "FREE" });
    expect(res.job_state).toBe("LISTED");
  });

  it("mode:'PROMOTED' carries budget — real money, explicit opt-in", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/publish`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_job_posting_published", job_state: "LISTED" });
      }),
    );
    await rec().publishJob("proj_1", "job_1", {
      mode: "PROMOTED",
      budget: { currency: "EUR", amount: 25, scope: "DAILY" },
    });
    expect(body).toEqual({ mode: "PROMOTED", budget: { currency: "EUR", amount: 25, scope: "DAILY" } });
  });
});

describe("recruiter.closeJob", () => {
  it("POST .../projects/{project_id}/jobs/{job_id}/close — no request body", async () => {
    let seenPath: string | undefined;
    let seenBody: string | null = null;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/close`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        seenBody = await request.text();
        return HttpResponse.json({ object: "recruiter_job_posting_closed" });
      }),
    );
    const res = await rec().closeJob("proj_1", "job_1");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/jobs/job_1/close`);
    expect(seenBody).toBe("");
    expect(res.object).toBe("recruiter_job_posting_closed");
  });
});

describe("recruiter.saveCandidate", () => {
  // was addCandidate; body is {stage_id, candidate_id}.
  it("POST .../projects/{project_id}/pipeline/candidate/save with {stage_id,candidate_id}", async () => {
    let seenPath: string | undefined;
    let body: unknown;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/pipeline/candidate/save`, async ({ request }) => {
        seenPath = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({ object: "recruiter_candidate_saved" });
      }),
    );
    await rec().saveCandidate("proj_1", { stage_id: "s", candidate_id: "c" });
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/pipeline/candidate/save`);
    expect(body).toEqual({ stage_id: "s", candidate_id: "c" });
  });
});

describe("recruiter.listApplicants", () => {
  // Resolved to a project-scoped POST-as-search; channel_id required.
  it("POST .../projects/{project_id}/talent-pool/applicants — channel_id required, limit/cursor top-level query", async () => {
    let method: string | undefined;
    let seenPath: string | undefined;
    let capturedUrl: string | undefined;
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/talent-pool/applicants`, async ({ request }) => {
        method = request.method;
        seenPath = new URL(request.url).pathname;
        capturedUrl = request.url;
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ object: "recruiter_job_applicant_list", data: [], cursor: null, total_count: 0 });
      }),
    );
    await rec().listApplicants("proj_1", { channel_id: "chan_1", keywords: "eng" }, { limit: 10, cursor: "cur_3" });
    expect(method).toBe("POST");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/talent-pool/applicants`);
    const params = new URL(capturedUrl!).searchParams;
    expect(params.get("limit")).toBe("10");
    expect(params.get("cursor")).toBe("cur_3");
    expect(body).toEqual({ channel_id: "chan_1", keywords: "eng" });
    expect(body?.channel_id).toBe("chan_1");
  });
});

describe("recruiter.getApplicant", () => {
  it("GET .../projects/{project_id}/talent-pool/applicants/{applicant_id}", async () => {
    let seenPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/talent-pool/applicants/app_1`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return HttpResponse.json({ object: "recruiter_job_applicant", id: "app_1" });
      }),
    );
    const res = await rec().getApplicant("proj_1", "app_1");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/talent-pool/applicants/app_1`);
    expect(res.object).toBe("recruiter_job_applicant");
  });
});

describe("recruiter.downloadResume", () => {
  it("GET .../applicants/{applicant_id}/resume returns an ArrayBuffer", async () => {
    let seenPath: string | undefined;
    server.use(
      http.get(`${BASE}/v1/${ACC}/recruiter/projects/proj_1/talent-pool/applicants/app_1/resume`, ({ request }) => {
        seenPath = new URL(request.url).pathname;
        return new HttpResponse(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }),
    );
    const buf = await rec().downloadResume("proj_1", "app_1");
    expect(seenPath).toBe(`/v1/${ACC}/recruiter/projects/proj_1/talent-pool/applicants/app_1/resume`);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  });
});

describe("recruiter — removed ops + addCandidate rename", () => {
  it("syncMessages, addApplicant, rejectApplicant, solveJobCheckpoint, addCandidate no longer exist", () => {
    const surface = rec() as unknown as Record<string, unknown>;
    expect(surface["syncMessages"]).toBeUndefined();
    expect(surface["addApplicant"]).toBeUndefined();
    expect(surface["rejectApplicant"]).toBeUndefined();
    expect(surface["solveJobCheckpoint"]).toBeUndefined();
    expect(surface["addCandidate"]).toBeUndefined();
    // renamed successor exists
    expect(typeof surface["saveCandidate"]).toBe("function");
  });
});
