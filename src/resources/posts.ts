/**
 * Posts resource — 7 methods.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * Create and comment are multipart-only per the OpenAPI spec. The SDK body type
 * mirrors the multipart/form-data shape (non-file scalars) plus an optional
 * `attachments` array — the transport detects FormData and sends multipart.
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type PostListPage =
  paths["/v1/posts"]["get"]["responses"]["200"]["content"]["application/json"];
export type PostListParams = NonNullable<
  paths["/v1/posts"]["get"]["parameters"]["query"]
>;

/**
 * `POST /v1/posts` body — mirrors the multipart/form-data schema (non-file scalars)
 * plus an optional `attachments` array the SDK builds into FormData.
 * `account_id` is optional because the account-scoped context injects it.
 */
type CreatePostFormFields =
  paths["/v1/posts"]["post"]["requestBody"]["content"]["multipart/form-data"];
export type CreatePostBody = Omit<CreatePostFormFields, "account_id" | "attachments" | "video_thumbnail"> & {
  account_id?: string;
  attachments?: Array<Buffer | File>;
  video_thumbnail?: Buffer | File;
};
export type CreatePostResult =
  paths["/v1/posts"]["post"]["responses"]["201"]["content"]["application/json"];

export type PostDetail =
  paths["/v1/posts/{post_id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type PostCommentListPage =
  paths["/v1/posts/{post_id}/comments"]["get"]["responses"]["200"]["content"]["application/json"];
export type PostCommentListParams = NonNullable<
  paths["/v1/posts/{post_id}/comments"]["get"]["parameters"]["query"]
>;

/**
 * `POST /v1/posts/{post_id}/comments` body — mirrors the multipart/form-data schema
 * plus an optional `attachments` array the SDK builds into FormData.
 * `account_id` is optional because the account-scoped context injects it.
 */
type CommentFormFields =
  paths["/v1/posts/{post_id}/comments"]["post"]["requestBody"]["content"]["multipart/form-data"];
export type PostCommentBody = Omit<CommentFormFields, "account_id" | "attachments"> & {
  account_id?: string;
  attachments?: Array<Buffer | File>;
};
export type PostCommentResult =
  paths["/v1/posts/{post_id}/comments"]["post"]["responses"]["201"]["content"]["application/json"];

export type PostReactionListPage =
  paths["/v1/posts/{post_id}/reactions"]["get"]["responses"]["200"]["content"]["application/json"];
export type PostReactionListParams = NonNullable<
  paths["/v1/posts/{post_id}/reactions"]["get"]["parameters"]["query"]
>;

export type PostReactBody =
  paths["/v1/posts/{post_id}/reactions"]["post"]["requestBody"]["content"]["application/json"];
export type PostReactResult =
  paths["/v1/posts/{post_id}/reactions"]["post"]["responses"]["200"]["content"]["application/json"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFormData(
  scalars: Record<string, unknown>,
  attachments?: Array<Buffer | File>,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(scalars)) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }
  for (const attachment of attachments ?? []) {
    if (attachment instanceof File) {
      form.append("attachments", attachment);
    } else {
      form.append("attachments", new Blob([attachment as unknown as BlobPart]));
    }
  }
  return form;
}

// ─── Resource class ───────────────────────────────────────────────────────────

export class PostsResource {
  constructor(protected readonly ctx: RequestContext) {}

  /** List the account's own posts. `GET /v1/posts` */
  list(params?: PostListParams): Promise<PostListPage> {
    return this.ctx.request<PostListPage>({
      method: "GET",
      path: "/v1/posts",
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Create a new post. Always sent as multipart/form-data (the API only accepts
   * multipart for this endpoint). `POST /v1/posts`
   */
  create(body: CreatePostBody): Promise<CreatePostResult> {
    const { attachments, video_thumbnail, ...scalars } = body;
    const form = buildFormData(scalars as Record<string, unknown>, attachments);
    if (video_thumbnail) {
      if (video_thumbnail instanceof File) {
        form.append("video_thumbnail", video_thumbnail);
      } else {
        form.append("video_thumbnail", new Blob([video_thumbnail as unknown as BlobPart]));
      }
    }
    return this.ctx.request<CreatePostResult>({
      method: "POST",
      path: "/v1/posts",
      body: form,
    });
  }

  /** Get a single post. `GET /v1/posts/{post_id}` */
  get(postId: string): Promise<PostDetail> {
    return this.ctx.request<PostDetail>({
      method: "GET",
      path: `/v1/posts/${postId}`,
    });
  }

  /** List comments on a post. `GET /v1/posts/{post_id}/comments` */
  listComments(postId: string, params?: PostCommentListParams): Promise<PostCommentListPage> {
    return this.ctx.request<PostCommentListPage>({
      method: "GET",
      path: `/v1/posts/${postId}/comments`,
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Comment on a post. Always sent as multipart/form-data. `POST /v1/posts/{post_id}/comments`
   */
  comment(postId: string, body: PostCommentBody): Promise<PostCommentResult> {
    const { attachments, ...scalars } = body;
    return this.ctx.request<PostCommentResult>({
      method: "POST",
      path: `/v1/posts/${postId}/comments`,
      body: buildFormData(scalars as Record<string, unknown>, attachments),
    });
  }

  /** List reactions on a post. `GET /v1/posts/{post_id}/reactions` */
  listReactions(postId: string, params?: PostReactionListParams): Promise<PostReactionListPage> {
    return this.ctx.request<PostReactionListPage>({
      method: "GET",
      path: `/v1/posts/${postId}/reactions`,
      ...(params ? { query: params } : {}),
    });
  }

  /** React to a post. `POST /v1/posts/{post_id}/reactions` */
  react(postId: string, body: PostReactBody): Promise<PostReactResult> {
    return this.ctx.request<PostReactResult>({
      method: "POST",
      path: `/v1/posts/${postId}/reactions`,
      body,
    });
  }
}
