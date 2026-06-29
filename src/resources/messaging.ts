/**
 * Messaging resource — 14 methods.
 *
 * Account-scoped: the bound context injects `account_id` into every request.
 * Multipart methods (`startChat`, `sendMessage`) accept `attachments: Array<Buffer | File>`
 * and build `FormData` automatically before calling the transport.
 * `getAttachment` returns `Promise<ArrayBuffer>` (binary response).
 */
import type { RequestContext } from "../internal/context.js";
import type { paths } from "../generated/types.js";

// ─── Type aliases from generated OpenAPI snapshot ──────────────────────────

export type ChatListPage =
  paths["/v1/chats"]["get"]["responses"]["200"]["content"]["application/json"];
export type ChatListParams = NonNullable<
  paths["/v1/chats"]["get"]["parameters"]["query"]
>;

/** `POST /v1/chats` JSON body (application/json variant). */
type StartChatJsonBody =
  paths["/v1/chats"]["post"]["requestBody"]["content"]["application/json"];
/**
 * Caller-facing body: JSON scalars plus optional attachments (SDK builds FormData).
 * `account_id` is optional because the account-scoped context injects it.
 */
export type StartChatBody = Omit<StartChatJsonBody, "account_id"> & {
  account_id?: string;
  attachments?: Array<Buffer | File>;
};
export type StartChatResult =
  paths["/v1/chats"]["post"]["responses"]["201"]["content"]["application/json"];

export type ChatDetail =
  paths["/v1/chats/{chat_id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type MessageListPage =
  paths["/v1/chats/{chat_id}/messages"]["get"]["responses"]["200"]["content"]["application/json"];
export type MessageListParams = NonNullable<
  paths["/v1/chats/{chat_id}/messages"]["get"]["parameters"]["query"]
>;

/** `POST /v1/chats/{chat_id}/messages` JSON body (application/json variant). */
type SendMessageJsonBody =
  paths["/v1/chats/{chat_id}/messages"]["post"]["requestBody"]["content"]["application/json"];
/**
 * Caller-facing body: JSON scalars plus optional attachments (SDK builds FormData).
 * `account_id` is optional because the account-scoped context injects it.
 */
export type SendMessageBody = Omit<SendMessageJsonBody, "account_id"> & {
  account_id?: string;
  attachments?: Array<Buffer | File>;
};
export type SendMessageResult =
  paths["/v1/chats/{chat_id}/messages"]["post"]["responses"]["201"]["content"]["application/json"];

export type ChatSyncResult =
  paths["/v1/chats/{chat_id}/sync"]["get"]["responses"]["200"]["content"]["application/json"];

export type MessageDetail =
  paths["/v1/messages/{message_id}"]["get"]["responses"]["200"]["content"]["application/json"];

export type EditMessageBody =
  paths["/v1/messages/{message_id}"]["patch"]["requestBody"]["content"]["application/json"];
export type EditMessageResult =
  paths["/v1/messages/{message_id}"]["patch"]["responses"]["200"]["content"]["application/json"];

export type DeleteMessageResult =
  paths["/v1/messages/{message_id}"]["delete"]["responses"]["200"]["content"]["application/json"];

export type AddReactionBody =
  paths["/v1/messages/{message_id}/reactions"]["post"]["requestBody"]["content"]["application/json"];
export type AddReactionResult =
  paths["/v1/messages/{message_id}/reactions"]["post"]["responses"]["200"]["content"]["application/json"];

export type SendInMailBody =
  paths["/v1/messages/inmail"]["post"]["requestBody"]["content"]["application/json"];
export type SendInMailResult =
  paths["/v1/messages/inmail"]["post"]["responses"]["201"]["content"]["application/json"];

export type InMailBalanceResult =
  paths["/v1/messaging/inmail-balance"]["get"]["responses"]["200"]["content"]["application/json"];

export type MessageSyncResult =
  paths["/v1/messages/sync"]["get"]["responses"]["200"]["content"]["application/json"];
export type MessageSyncParams = NonNullable<
  paths["/v1/messages/sync"]["get"]["parameters"]["query"]
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a `FormData` from a body object that contains scalar fields and an
 * optional `attachments` array of `Buffer | File`. Used for multipart methods.
 */
function buildFormData(
  scalars: Record<string, unknown>,
  attachments: Array<Buffer | File>,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(scalars)) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  }
  for (const attachment of attachments) {
    if (attachment instanceof File) {
      form.append("attachments", attachment);
    } else {
      // Buffer — wrap in a Blob so FormData accepts it.
      form.append("attachments", new Blob([attachment as unknown as BlobPart]));
    }
  }
  return form;
}

// ─── Resource class ───────────────────────────────────────────────────────────

export class MessagingResource {
  constructor(protected readonly ctx: RequestContext) {}

  /** List paginated chats for the account. `GET /v1/chats` */
  listChats(params?: ChatListParams): Promise<ChatListPage> {
    return this.ctx.request<ChatListPage>({
      method: "GET",
      path: "/v1/chats",
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Start a new chat. Accepts optional `attachments[]` — when present, the
   * request is sent as `multipart/form-data`. `POST /v1/chats`
   */
  startChat(body: StartChatBody): Promise<StartChatResult> {
    const { attachments, ...scalars } = body;
    if (attachments && attachments.length > 0) {
      return this.ctx.request<StartChatResult>({
        method: "POST",
        path: "/v1/chats",
        body: buildFormData(scalars as Record<string, unknown>, attachments),
        accountIdIn: "body",
      });
    }
    return this.ctx.request<StartChatResult>({
      method: "POST",
      path: "/v1/chats",
      body: scalars,
      accountIdIn: "body",
    });
  }

  /** Get details of a single chat. `GET /v1/chats/{chat_id}` */
  getChat(chatId: string): Promise<ChatDetail> {
    return this.ctx.request<ChatDetail>({
      method: "GET",
      path: `/v1/chats/${chatId}`,
    });
  }

  /** List messages in a chat, cursor-paginated. `GET /v1/chats/{chat_id}/messages` */
  listMessages(chatId: string, params?: MessageListParams): Promise<MessageListPage> {
    return this.ctx.request<MessageListPage>({
      method: "GET",
      path: `/v1/chats/${chatId}/messages`,
      ...(params ? { query: params } : {}),
    });
  }

  /**
   * Send a message in a chat. Multipart when `attachments[]` are provided.
   * `POST /v1/chats/{chat_id}/messages`
   */
  sendMessage(chatId: string, body: SendMessageBody): Promise<SendMessageResult> {
    const { attachments, ...scalars } = body;
    if (attachments && attachments.length > 0) {
      return this.ctx.request<SendMessageResult>({
        method: "POST",
        path: `/v1/chats/${chatId}/messages`,
        body: buildFormData(scalars as Record<string, unknown>, attachments),
        accountIdIn: "body",
      });
    }
    return this.ctx.request<SendMessageResult>({
      method: "POST",
      path: `/v1/chats/${chatId}/messages`,
      body: scalars,
      accountIdIn: "body",
    });
  }

  /** Trigger a re-sync of a specific chat's message history. `GET /v1/chats/{chat_id}/sync` */
  syncChat(chatId: string): Promise<ChatSyncResult> {
    return this.ctx.request<ChatSyncResult>({
      method: "GET",
      path: `/v1/chats/${chatId}/sync`,
    });
  }

  /** Get a single message by ID. `GET /v1/messages/{message_id}` */
  getMessage(messageId: string): Promise<MessageDetail> {
    return this.ctx.request<MessageDetail>({
      method: "GET",
      path: `/v1/messages/${messageId}`,
    });
  }

  /** Edit a message within the ~60-minute edit window. `PATCH /v1/messages/{message_id}` */
  editMessage(messageId: string, body: EditMessageBody): Promise<EditMessageResult> {
    return this.ctx.request<EditMessageResult>({
      method: "PATCH",
      path: `/v1/messages/${messageId}`,
      body,
    });
  }

  /** Delete a message within the delete window. `DELETE /v1/messages/{message_id}` */
  deleteMessage(messageId: string): Promise<DeleteMessageResult> {
    return this.ctx.request<DeleteMessageResult>({
      method: "DELETE",
      path: `/v1/messages/${messageId}`,
      accountIdIn: "none", // server resolves owning account from message id (#324)
    });
  }

  /**
   * Download a message attachment. Returns raw binary.
   * `GET /v1/messages/{message_id}/attachments/{attachment_id}`
   * Returns `ArrayBuffer` — binary response; the SDK does not cache or store it.
   */
  getAttachment(messageId: string, attachmentId: string): Promise<ArrayBuffer> {
    return this.ctx.request<ArrayBuffer>({
      method: "GET",
      path: `/v1/messages/${messageId}/attachments/${attachmentId}`,
    });
  }

  /** Add a reaction to a message. `POST /v1/messages/{message_id}/reactions` */
  addReaction(messageId: string, body: AddReactionBody): Promise<AddReactionResult> {
    return this.ctx.request<AddReactionResult>({
      method: "POST",
      path: `/v1/messages/${messageId}/reactions`,
      body,
      accountIdIn: "none", // server resolves owning account from message id (#324)
    });
  }

  /** Send an InMail. `POST /v1/messages/inmail` */
  sendInMail(body: SendInMailBody): Promise<SendInMailResult> {
    return this.ctx.request<SendInMailResult>({
      method: "POST",
      path: "/v1/messages/inmail",
      body,
      accountIdIn: "body",
    });
  }

  /** Get the account's InMail credit balance. `GET /v1/messaging/inmail-balance` */
  getInMailBalance(params?: { account_id?: string }): Promise<InMailBalanceResult> {
    return this.ctx.request<InMailBalanceResult>({
      method: "GET",
      path: "/v1/messaging/inmail-balance",
      ...(params ? { query: params } : {}),
    });
  }

  /** Re-sync account message history. `GET /v1/messages/sync` */
  syncMessages(params?: MessageSyncParams): Promise<MessageSyncResult> {
    return this.ctx.request<MessageSyncResult>({
      method: "GET",
      path: "/v1/messages/sync",
      ...(params ? { query: params } : {}),
    });
  }
}
