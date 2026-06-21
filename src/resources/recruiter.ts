/**
 * Recruiter resource — 17 methods (sdk/002 FR-002; tier: recruiter).
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * startChat accepts optional `attachments[]`, `voice_message`, `video_message`
 * and builds `FormData` (sdk/002 FR-004).
 * downloadResume returns `Promise<ArrayBuffer>` (sdk/002 FR-005).
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type RecruiterSyncMessagesParams = NonNullable<
  paths["/v1/recruiter/messages/sync"]["get"]["parameters"]["query"]
>;
export type RecruiterSyncMessagesResult =
  paths["/v1/recruiter/messages/sync"]["get"]["responses"]["200"]["content"]["application/json"];

/** `POST /v1/recruiter/chats` multipart/form-data fields (non-file scalars). */
type RecruiterStartChatFormFields =
  paths["/v1/recruiter/chats"]["post"]["requestBody"]["content"]["multipart/form-data"];
/**
 * Caller-facing body: scalar fields plus optional `attachments`, `voice_message`,
 * and `video_message` (SDK builds FormData internally — sdk/002 FR-004).
 * `account_id` is optional because the account-scoped context injects it.
 */
export type RecruiterStartChatBody = Omit<
  RecruiterStartChatFormFields,
  "account_id" | "attachments" | "voice_message" | "video_message"
> & {
  account_id?: string;
  attachments?: Array<Buffer | File>;
  voice_message?: Buffer | File;
  video_message?: Buffer | File;
};
export type RecruiterStartChatResult =
  paths["/v1/recruiter/chats"]["post"]["responses"]["201"]["content"]["application/json"];

export type RecruiterGetProfileParams = NonNullable<
  paths["/v1/recruiter/profiles/{identifier}"]["get"]["parameters"]["query"]
>;
export type RecruiterGetProfileResult =
  paths["/v1/recruiter/profiles/{identifier}"]["get"]["responses"]["200"]["content"]["application/json"];

export type RecruiterSearchPeopleBody =
  paths["/v1/recruiter/search/people"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterSearchPeopleParams = NonNullable<
  paths["/v1/recruiter/search/people"]["post"]["parameters"]["query"]
>;
export type RecruiterSearchPeopleResult =
  paths["/v1/recruiter/search/people"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterGetParametersParams = NonNullable<
  paths["/v1/recruiter/search/parameters"]["get"]["parameters"]["query"]
>;
export type RecruiterGetParametersResult =
  paths["/v1/recruiter/search/parameters"]["get"]["responses"]["200"]["content"]["application/json"];

export type RecruiterListProjectsParams = NonNullable<
  paths["/v1/recruiter/projects"]["get"]["parameters"]["query"]
>;
export type RecruiterListProjectsResult =
  paths["/v1/recruiter/projects"]["get"]["responses"]["200"]["content"]["application/json"];

export type RecruiterGetProjectResult =
  paths["/v1/recruiter/projects/{project_id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type RecruiterAddCandidateBody =
  paths["/v1/recruiter/projects/candidates/{user_id}"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterAddCandidateResult =
  paths["/v1/recruiter/projects/candidates/{user_id}"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterAddApplicantBody =
  paths["/v1/recruiter/projects/applicants/{user_id}"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterAddApplicantResult =
  paths["/v1/recruiter/projects/applicants/{user_id}"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterRejectApplicantBody =
  paths["/v1/recruiter/projects/applicants/{user_id}/reject"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterRejectApplicantResult =
  paths["/v1/recruiter/projects/applicants/{user_id}/reject"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterListJobsParams = NonNullable<
  paths["/v1/recruiter/jobs"]["get"]["parameters"]["query"]
>;
export type RecruiterListJobsResult =
  paths["/v1/recruiter/jobs"]["get"]["responses"]["200"]["content"]["application/json"];

export type RecruiterCreateJobBody =
  paths["/v1/recruiter/jobs"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterCreateJobResult =
  paths["/v1/recruiter/jobs"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterPublishJobBody =
  paths["/v1/recruiter/jobs/{job_id}/publish"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterPublishJobResult =
  paths["/v1/recruiter/jobs/{job_id}/publish"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterSolveJobCheckpointBody =
  paths["/v1/recruiter/jobs/{job_id}/checkpoint"]["post"]["requestBody"]["content"]["application/json"];
export type RecruiterSolveJobCheckpointResult =
  paths["/v1/recruiter/jobs/{job_id}/checkpoint"]["post"]["responses"]["200"]["content"]["application/json"];

export type RecruiterListApplicantsParams = NonNullable<
  paths["/v1/recruiter/jobs/{job_id}/applicants"]["get"]["parameters"]["query"]
>;
export type RecruiterListApplicantsResult =
  paths["/v1/recruiter/jobs/{job_id}/applicants"]["get"]["responses"]["200"]["content"]["application/json"];

export type RecruiterGetApplicantResult =
  paths["/v1/recruiter/jobs/applicants/{applicant_id}"]["get"]["responses"]["200"]["content"]["application/json"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFormData(
  scalars: Record<string, unknown>,
  attachments?: Array<Buffer | File>,
  voice_message?: Buffer | File,
  video_message?: Buffer | File,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(scalars)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          form.append(key, String(item));
        }
      } else {
        form.append(key, String(value));
      }
    }
  }
  for (const attachment of attachments ?? []) {
    if (attachment instanceof File) {
      form.append("attachments", attachment);
    } else {
      form.append("attachments", new Blob([attachment as unknown as BlobPart]));
    }
  }
  if (voice_message) {
    if (voice_message instanceof File) {
      form.append("voice_message", voice_message);
    } else {
      form.append("voice_message", new Blob([voice_message as unknown as BlobPart]));
    }
  }
  if (video_message) {
    if (video_message instanceof File) {
      form.append("video_message", video_message);
    } else {
      form.append("video_message", new Blob([video_message as unknown as BlobPart]));
    }
  }
  return form;
}

// ─── Resource class ───────────────────────────────────────────────────────────

export class RecruiterResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Trigger a re-sync of the account's Recruiter message history.
   * `GET /v1/recruiter/messages/sync`
   */
  syncMessages(params: RecruiterSyncMessagesParams): Promise<RecruiterSyncMessagesResult> {
    return this.ctx.request<RecruiterSyncMessagesResult>({
      method: "GET",
      path: "/v1/recruiter/messages/sync",
      query: params,
    });
  }

  /**
   * Start a Recruiter chat (InMail). Accepts optional `attachments[]`,
   * `voice_message`, and `video_message` — when present the request is sent
   * as `multipart/form-data` (sdk/002 FR-004). `POST /v1/recruiter/chats`
   */
  startChat(body: RecruiterStartChatBody): Promise<RecruiterStartChatResult> {
    const { attachments, voice_message, video_message, ...scalars } = body;
    const hasFiles =
      (attachments && attachments.length > 0) || voice_message || video_message;
    if (hasFiles) {
      return this.ctx.request<RecruiterStartChatResult>({
        method: "POST",
        path: "/v1/recruiter/chats",
        body: buildFormData(
          scalars as Record<string, unknown>,
          attachments,
          voice_message,
          video_message,
        ),
      });
    }
    return this.ctx.request<RecruiterStartChatResult>({
      method: "POST",
      path: "/v1/recruiter/chats",
      body: scalars,
    });
  }

  /**
   * Retrieve a LinkedIn profile with Recruiter enrichment.
   * `GET /v1/recruiter/profiles/{identifier}`
   */
  getProfile(identifier: string, params?: Partial<RecruiterGetProfileParams>): Promise<RecruiterGetProfileResult> {
    return this.ctx.request<RecruiterGetProfileResult>({
      method: "GET",
      path: `/v1/recruiter/profiles/${identifier}`,
      // cast needed: linkedin_sections is string[] but transport encodes arrays as repeated params
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /**
   * Search LinkedIn members using Recruiter filters.
   * `POST /v1/recruiter/search/people`
   */
  searchPeople(body: RecruiterSearchPeopleBody, params?: Partial<RecruiterSearchPeopleParams>): Promise<RecruiterSearchPeopleResult> {
    return this.ctx.request<RecruiterSearchPeopleResult>({
      method: "POST",
      path: "/v1/recruiter/search/people",
      body,
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Resolve human-readable terms to opaque Recruiter filter IDs.
   * `GET /v1/recruiter/search/parameters`
   */
  getParameters(params: RecruiterGetParametersParams): Promise<RecruiterGetParametersResult> {
    return this.ctx.request<RecruiterGetParametersResult>({
      method: "GET",
      path: "/v1/recruiter/search/parameters",
      query: params,
    });
  }

  /**
   * List Recruiter hiring projects. `GET /v1/recruiter/projects`
   */
  listProjects(params?: Partial<RecruiterListProjectsParams>): Promise<RecruiterListProjectsResult> {
    return this.ctx.request<RecruiterListProjectsResult>({
      method: "GET",
      path: "/v1/recruiter/projects",
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Get a single Recruiter hiring project. `GET /v1/recruiter/projects/{project_id}`
   */
  getProject(projectId: string): Promise<RecruiterGetProjectResult> {
    return this.ctx.request<RecruiterGetProjectResult>({
      method: "GET",
      path: `/v1/recruiter/projects/${projectId}`,
    });
  }

  /**
   * Add a member to a hiring project pipeline as a candidate.
   * `POST /v1/recruiter/projects/candidates/{user_id}`
   */
  addCandidate(userId: string, body: RecruiterAddCandidateBody): Promise<RecruiterAddCandidateResult> {
    return this.ctx.request<RecruiterAddCandidateResult>({
      method: "POST",
      path: `/v1/recruiter/projects/candidates/${userId}`,
      body,
    });
  }

  /**
   * Add a member to a hiring project pipeline as an applicant.
   * `POST /v1/recruiter/projects/applicants/{user_id}`
   */
  addApplicant(userId: string, body: RecruiterAddApplicantBody): Promise<RecruiterAddApplicantResult> {
    return this.ctx.request<RecruiterAddApplicantResult>({
      method: "POST",
      path: `/v1/recruiter/projects/applicants/${userId}`,
      body,
    });
  }

  /**
   * Reject an applicant from a hiring project.
   * `POST /v1/recruiter/projects/applicants/{user_id}/reject`
   */
  rejectApplicant(userId: string, body: RecruiterRejectApplicantBody): Promise<RecruiterRejectApplicantResult> {
    return this.ctx.request<RecruiterRejectApplicantResult>({
      method: "POST",
      path: `/v1/recruiter/projects/applicants/${userId}/reject`,
      body,
    });
  }

  /**
   * List Recruiter job postings. `GET /v1/recruiter/jobs`
   */
  listJobs(params?: Partial<RecruiterListJobsParams>): Promise<RecruiterListJobsResult> {
    return this.ctx.request<RecruiterListJobsResult>({
      method: "GET",
      path: "/v1/recruiter/jobs",
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Create a Recruiter job posting draft. `POST /v1/recruiter/jobs`
   */
  createJob(body: RecruiterCreateJobBody): Promise<RecruiterCreateJobResult> {
    return this.ctx.request<RecruiterCreateJobResult>({
      method: "POST",
      path: "/v1/recruiter/jobs",
      body,
    });
  }

  /**
   * Publish a Recruiter job posting draft.
   * `POST /v1/recruiter/jobs/{job_id}/publish`
   */
  publishJob(jobId: string, body: RecruiterPublishJobBody): Promise<RecruiterPublishJobResult> {
    return this.ctx.request<RecruiterPublishJobResult>({
      method: "POST",
      path: `/v1/recruiter/jobs/${jobId}/publish`,
      body,
    });
  }

  /**
   * Solve a publish verification checkpoint.
   * `POST /v1/recruiter/jobs/{job_id}/checkpoint`
   */
  solveJobCheckpoint(jobId: string, body: RecruiterSolveJobCheckpointBody): Promise<RecruiterSolveJobCheckpointResult> {
    return this.ctx.request<RecruiterSolveJobCheckpointResult>({
      method: "POST",
      path: `/v1/recruiter/jobs/${jobId}/checkpoint`,
      body,
    });
  }

  /**
   * List applicants for a job posting.
   * `GET /v1/recruiter/jobs/{job_id}/applicants`
   */
  listApplicants(jobId: string, params?: Partial<RecruiterListApplicantsParams>): Promise<RecruiterListApplicantsResult> {
    return this.ctx.request<RecruiterListApplicantsResult>({
      method: "GET",
      path: `/v1/recruiter/jobs/${jobId}/applicants`,
      // cast needed: include_degree / exclude_degree can be string[] but transport encodes arrays as repeated params
      ...(params ? { query: params as Record<string, string | number | boolean | null | undefined> } : {}),
    });
  }

  /**
   * Get one job applicant. `GET /v1/recruiter/jobs/applicants/{applicant_id}`
   */
  getApplicant(applicantId: string): Promise<RecruiterGetApplicantResult> {
    return this.ctx.request<RecruiterGetApplicantResult>({
      method: "GET",
      path: `/v1/recruiter/jobs/applicants/${applicantId}`,
    });
  }

  /**
   * Download an applicant's resume as raw binary.
   * `GET /v1/recruiter/jobs/applicants/{applicant_id}/resume`
   * Returns `ArrayBuffer` — sdk/002 FR-005 (binary response; never stored by the SDK).
   */
  downloadResume(applicantId: string): Promise<ArrayBuffer> {
    return this.ctx.request<ArrayBuffer>({
      method: "GET",
      path: `/v1/recruiter/jobs/applicants/${applicantId}/resume`,
    });
  }
}
