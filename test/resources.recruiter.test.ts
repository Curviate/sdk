// recruiter namespace (17 methods; tier: recruiter)
// TDD: MSW happy-path for every method + binary download + tier error tests.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server.js";
import { Curviate } from "../src/index.js";
import { CurviateError, isCurviateError } from "../src/errors.js";

const BASE = "https://app.curviate.test";
const ACC = "acc_rec1";
const client = new Curviate({ apiKey: "cvt_test_recruiter", baseUrl: BASE });
const rec = () => client.account(ACC).recruiter;

// ─── recruiter.syncMessages (GET /v1/recruiter/messages/sync) ────────────────
describe("recruiter.syncMessages", () => {
  it("GET /v1/recruiter/messages/sync returns sync status", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/messages/sync`, () =>
        HttpResponse.json({ object: "account_sync", sync_status: "sync_started" }),
      ),
    );
    const res = await rec().syncMessages({ account_id: ACC });
    expect(res.sync_status).toBe("sync_started");
  });

  it("throws CurviateError with required_tier when TIER_NOT_ACTIVE", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/messages/sync`, () =>
        HttpResponse.json(
          {
            code: "TIER_NOT_ACTIVE",
            message: "Recruiter add-on required.",
            required_tier: "recruiter",
            user_fixable: true,
            retry_likely_to_succeed: false,
          },
          { status: 403 },
        ),
      ),
    );
    const err = await rec().syncMessages({ account_id: ACC }).catch((e: unknown) => e);
    expect(isCurviateError(err)).toBe(true);
    expect((err as CurviateError).code).toBe("TIER_NOT_ACTIVE");
    expect((err as CurviateError).requiredTier).toBe("recruiter");
  });
});

// ─── recruiter.startChat (POST /v1/recruiter/chats) multipart ────────────────
describe("recruiter.startChat", () => {
  it("POST /v1/recruiter/chats returns chat shape", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/chats`, () =>
        HttpResponse.json(
          { chat_id: "recchat_1", attendee_ids: ["AEa_abc"] },
          { status: 201 },
        ),
      ),
    );
    const res = await rec().startChat({
      account_id: ACC,
      attendee_ids: ["AEa_abc"],
      text: "Hi from Recruiter",
    });
    expect(res.chat_id).toBe("recchat_1");
  });

  it("sends multipart/form-data when attachments provided", async () => {
    let ct: string | null = null;
    server.use(
      http.post(`${BASE}/v1/recruiter/chats`, ({ request }) => {
        ct = request.headers.get("content-type");
        return HttpResponse.json(
          { chat_id: "recchat_2", attendee_ids: ["AEa_abc"] },
          { status: 201 },
        );
      }),
    );
    const buf = Buffer.from("resume-attachment");
    await rec().startChat({
      account_id: ACC,
      attendee_ids: ["AEa_abc"],
      text: "With attachment",
      attachments: [buf],
    });
    expect(ct).toMatch(/^multipart\/form-data/);
  });
});

// ─── recruiter.getProfile (GET /v1/recruiter/profiles/:identifier) ───────────
describe("recruiter.getProfile", () => {
  it("GET /v1/recruiter/profiles/:identifier returns profile", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/profiles/AEa_abc`, () =>
        HttpResponse.json({
          object: "profile",
          provider_id: "AEa_abc",
          public_identifier: null,
          public_profile_url: null,
          first_name: "Bob",
          last_name: "Smith",
          headline: "Engineer",
          location: "Berlin",
          profile_picture_url: null,
          network_distance: null,
          is_open_profile: false,
          is_premium: false,
        }),
      ),
    );
    const res = await rec().getProfile("AEa_abc");
    expect(res.provider_id).toBe("AEa_abc");
  });
});

// ─── recruiter.searchPeople (POST /v1/recruiter/search/people) ───────────────
describe("recruiter.searchPeople", () => {
  it("POST /v1/recruiter/search/people returns result page", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/search/people`, () =>
        HttpResponse.json({ object: "recruiter_people_search_result_list", items: [], cursor: null }),
      ),
    );
    const res = await rec().searchPeople({});
    expect(res.object).toBe("recruiter_people_search_result_list");
  });
});

// ─── recruiter.getParameters (GET /v1/recruiter/search/parameters) ───────────
describe("recruiter.getParameters", () => {
  it("GET /v1/recruiter/search/parameters returns parameter list", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/search/parameters`, () =>
        HttpResponse.json({ object: "recruiter_search_parameter_list", items: [] }),
      ),
    );
    const res = await rec().getParameters({ account_id: ACC, type: "DEPARTMENT" });
    expect(res.object).toBe("recruiter_search_parameter_list");
  });
});

// ─── recruiter.listProjects (GET /v1/recruiter/projects) ─────────────────────
describe("recruiter.listProjects", () => {
  it("GET /v1/recruiter/projects returns project list", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/projects`, () =>
        HttpResponse.json({ object: "recruiter_hiring_project_list", items: [], cursor: null }),
      ),
    );
    const res = await rec().listProjects();
    expect(res.object).toBe("recruiter_hiring_project_list");
  });
});

// ─── recruiter.getProject (GET /v1/recruiter/projects/:project_id) ───────────
describe("recruiter.getProject", () => {
  it("GET /v1/recruiter/projects/:project_id returns project detail", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/projects/proj_1`, () =>
        HttpResponse.json({ object: "recruiter_hiring_project", id: "proj_1" }),
      ),
    );
    const res = await rec().getProject("proj_1");
    expect(res.id).toBe("proj_1");
  });
});

// ─── recruiter.addCandidate (POST /v1/recruiter/projects/candidates/:user_id) ─
describe("recruiter.addCandidate", () => {
  it("POST /v1/recruiter/projects/candidates/:user_id adds candidate", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/projects/candidates/AEa_abc`, () =>
        HttpResponse.json({ object: "candidate_added", user_id: "AEa_abc" }),
      ),
    );
    const res = await rec().addCandidate("AEa_abc", { account_id: ACC, hiring_project_id: "proj_1" });
    expect(res.user_id).toBe("AEa_abc");
  });
});

// ─── recruiter.addApplicant (POST /v1/recruiter/projects/applicants/:user_id) ─
describe("recruiter.addApplicant", () => {
  it("POST /v1/recruiter/projects/applicants/:user_id adds applicant", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/projects/applicants/AEa_abc`, () =>
        HttpResponse.json({ object: "applicant_added", user_id: "AEa_abc" }),
      ),
    );
    const res = await rec().addApplicant("AEa_abc", { account_id: ACC, hiring_project_id: "proj_1" });
    expect(res.user_id).toBe("AEa_abc");
  });
});

// ─── recruiter.rejectApplicant (POST /v1/recruiter/projects/applicants/:user_id/reject) ─
describe("recruiter.rejectApplicant", () => {
  it("POST /v1/recruiter/projects/applicants/:user_id/reject rejects applicant", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/projects/applicants/AEa_abc/reject`, () =>
        HttpResponse.json({ object: "applicant_rejected", user_id: "AEa_abc" }),
      ),
    );
    const res = await rec().rejectApplicant("AEa_abc", {
      account_id: ACC,
      hiring_project_id: "proj_1",
      reason: "NOT_MEET_BASIC_QUALIFICATIONS",
    });
    expect(res.user_id).toBe("AEa_abc");
  });
});

// ─── recruiter.listJobs (GET /v1/recruiter/jobs) ──────────────────────────────
describe("recruiter.listJobs", () => {
  it("GET /v1/recruiter/jobs returns job list", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/jobs`, () =>
        HttpResponse.json({ object: "recruiter_job_posting_list", items: [], cursor: null }),
      ),
    );
    const res = await rec().listJobs();
    expect(res.object).toBe("recruiter_job_posting_list");
  });
});

// ─── recruiter.createJob (POST /v1/recruiter/jobs) ────────────────────────────
describe("recruiter.createJob", () => {
  it("POST /v1/recruiter/jobs creates a draft job", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/jobs`, () =>
        HttpResponse.json(
          { object: "recruiter_job_posting_draft", job_id: "job_1", status: "draft" },
          { status: 201 },
        ),
      ),
    );
    const res = await rec().createJob({
      account_id: ACC,
      job_title: { text: "SWE" },
      company: { id: "co_1" },
      description: "A great role",
      workplace: "REMOTE",
      location: "12345",
      employment_type: "FULL_TIME",
      recruiter: {
        project: { id: "proj_1" },
        functions: ["eng_1"],
        industries: ["ind_1"],
        seniority: "MID_SENIOR_LEVEL",
        apply_method: {
          type: "linkedin",
          notification_email: "hr@example.com",
          resume_required: true,
        },
      },
    });
    expect(res.job_id).toBe("job_1");
  });
});

// ─── recruiter.publishJob (POST /v1/recruiter/jobs/:job_id/publish) ───────────
describe("recruiter.publishJob", () => {
  it("POST /v1/recruiter/jobs/:job_id/publish returns published shape", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/jobs/job_1/publish`, () =>
        HttpResponse.json({ object: "job_posting_published", job_id: "job_1" }),
      ),
    );
    const res = await rec().publishJob("job_1", { account_id: ACC, mode: "FREE" });
    expect(res.job_id).toBe("job_1");
  });
});

// ─── recruiter.solveJobCheckpoint (POST /v1/recruiter/jobs/:job_id/checkpoint) ─
describe("recruiter.solveJobCheckpoint", () => {
  it("POST /v1/recruiter/jobs/:job_id/checkpoint solves the checkpoint", async () => {
    server.use(
      http.post(`${BASE}/v1/recruiter/jobs/job_1/checkpoint`, () =>
        HttpResponse.json({ object: "job_posting_published", job_id: "job_1" }),
      ),
    );
    const res = await rec().solveJobCheckpoint("job_1", { account_id: ACC, input: "123456" });
    expect(res.job_id).toBe("job_1");
  });
});

// ─── recruiter.listApplicants (GET /v1/recruiter/jobs/:job_id/applicants) ─────
describe("recruiter.listApplicants", () => {
  it("GET /v1/recruiter/jobs/:job_id/applicants returns applicant list", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/jobs/job_1/applicants`, () =>
        HttpResponse.json({ object: "recruiter_applicant_list", items: [], cursor: null }),
      ),
    );
    const res = await rec().listApplicants("job_1");
    expect(res.object).toBe("recruiter_applicant_list");
  });
});

// ─── recruiter.getApplicant (GET /v1/recruiter/jobs/applicants/:applicant_id) ─
describe("recruiter.getApplicant", () => {
  it("GET /v1/recruiter/jobs/applicants/:applicant_id returns applicant detail", async () => {
    server.use(
      http.get(`${BASE}/v1/recruiter/jobs/applicants/app_1`, () =>
        HttpResponse.json({ object: "recruiter_applicant", id: "app_1" }),
      ),
    );
    const res = await rec().getApplicant("app_1");
    expect(res.id).toBe("app_1");
  });
});

// ─── recruiter.downloadResume (GET /v1/recruiter/jobs/applicants/:applicant_id/resume) ─
describe("recruiter.downloadResume", () => {
  it("returns ArrayBuffer with the raw bytes", async () => {
    const bytes = new Uint8Array([80, 68, 70]); // "PDF" header bytes
    server.use(
      http.get(`${BASE}/v1/recruiter/jobs/applicants/app_1/resume`, () =>
        new HttpResponse(bytes, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        }),
      ),
    );
    const buf = await rec().downloadResume("app_1");
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBe(3);
    expect(new Uint8Array(buf)[0]).toBe(80); // 'P'
  });
});
