/**
 * Jobs resource — 1 method.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";
import { resolveJobId } from "../internal/job-id.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip `account_id` from a query-param type (injected by the account-scoped context). */
type WithoutAccountId<T> = Omit<T, "account_id">;

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

/**
 * The job-posting shape returned by `jobs.get()` and `recruiter.getJob()` —
 * the two endpoints return the same shape (Core vs. Recruiter lens), so this
 * is the single canonical type; `recruiter.ts` reuses it rather than
 * deriving a duplicate from its own path.
 */
export type JobPosting =
  paths["/v1/jobs/{job_id}"]["get"]["responses"]["200"]["content"]["application/json"];

/** Caller-facing query params for `jobs.get()` — `account_id` is injected by context. */
export type JobGetParams = WithoutAccountId<
  paths["/v1/jobs/{job_id}"]["get"]["parameters"]["query"]
>;

// ─── Resource class ───────────────────────────────────────────────────────────

export class JobsResource {
  constructor(protected readonly ctx: RequestContext) {}

  /**
   * Retrieve one public LinkedIn job posting's full detail.
   * `GET /v1/jobs/{job_id}`
   *
   * Accepts a bare numeric job id or a full job URL
   * (`https://www.linkedin.com/jobs/view/{id}`) — the id is extracted
   * client-side; the wire request always carries the numeric id. Throws
   * `CurviateError({ code: 'INVALID_REQUEST' })` synchronously if neither
   * form can be recognized.
   * The `account_id` is injected by the account-scoped context.
   */
  get(jobIdOrUrl: string, params?: JobGetParams): Promise<JobPosting> {
    const jobId = resolveJobId(jobIdOrUrl);
    return this.ctx.request<JobPosting>({
      method: "GET",
      path: `/v1/jobs/${jobId}`,
      ...(params ? { query: params as Record<string, string | number | boolean | string[] | undefined | null> } : {}),
    });
  }
}
