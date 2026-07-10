// Path-grammar bank — the account-first `/v1/{account_id}/…` grammar proven at
// the resource-wrapper level (the seam itself is proven directly against
// `createContext` in test/internal/context.test.ts).
//
// Every account-scoped method must build a URL whose account id is the FIRST
// `/v1/` path segment; every root-scoped method must build a URL with NO
// account segment at all, and `account_id` must never leak into the query
// string for either. Table-driven: this file owns the runner (`CASES` + the
// `it.each` below); later resource chunks (messaging / users / recruiter /
// sales-navigator / jobs / comments / posts / invites / search / companies)
// append their own account-scoped rows to `CASES` as they realign, without
// touching the runner.
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../msw/server.js";
import { Curviate } from "../../src/index.js";

const BASE = "https://app.curviate.test";
const ACCOUNT_ID = "acc_test";

interface CapturedRequest {
  path: string;
  search: URLSearchParams;
}

interface PathGrammarCase {
  /** `<namespace>.<method>` — purely descriptive, shows up in the test name. */
  name: string;
  /** `"account"` rows must lead with `/v1/acc_test/`; `"root"` rows must not. */
  scope: "root" | "account";
  /**
   * Register the matching MSW handler, issue the call against `client`, and
   * return the captured request's path + query. `client` is always the root
   * `Curviate` instance — an account-scoped row calls
   * `client.account(ACCOUNT_ID).<namespace>.<method>()` itself.
   */
  run: (client: Curviate) => Promise<CapturedRequest>;
}

const CASES: PathGrammarCase[] = [
  // ─── Root-scoped: accounts ────────────────────────────────────────────────
  {
    name: "accounts.list",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/accounts`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "account_list", items: [], cursor: null });
        }),
      );
      await client.accounts.list();
      return captured!;
    },
  },
  {
    name: "accounts.get",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/accounts/${ACCOUNT_ID}`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "account", account_id: ACCOUNT_ID, status: "active", quotas: [] });
        }),
      );
      await client.accounts.get(ACCOUNT_ID);
      return captured!;
    },
  },

  // ─── Root-scoped: auth — account_id (when present) is a body field, never
  // a path segment or query param.
  {
    name: "auth.intent",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/auth/intent`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json(
            { object: "account", account_id: "acc_1", status: "active" },
            { status: 201 },
          );
        }),
      );
      await client.auth.intent({
        seat_id: "seat_1",
        auth_method: "credentials",
        credentials: { email: "u@x.com", password: "p" },
      });
      return captured!;
    },
  },
  {
    name: "auth.getSession",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/auth/sessions/acc_prov`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({
            object: "auth_session",
            session_id: "acc_prov",
            status: "done",
            account_id: "acc_1",
          });
        }),
      );
      await client.auth.getSession("acc_prov");
      return captured!;
    },
  },

  // ─── Root-scoped: webhooks ────────────────────────────────────────────────
  {
    name: "webhooks.list",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/webhooks`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "webhook_list", items: [], cursor: null });
        }),
      );
      await client.webhooks.list();
      return captured!;
    },
  },
  {
    name: "webhooks.get",
    scope: "root",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/webhooks/wh_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "webhook", id: "wh_1", source: "messaging" });
        }),
      );
      await client.webhooks.get("wh_1");
      return captured!;
    },
  },

  // ─── Account-scoped: users (SDK-C1) ─────────────────────────────────────
  {
    name: "users.get",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/users/me`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "user_profile", id: "u_1", type: "individual", display_name: "Alice", specifics: {} });
        }),
      );
      await client.account(ACCOUNT_ID).users.get("me");
      return captured!;
    },
  },
  {
    name: "users.update",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.patch(`${BASE}/v1/${ACCOUNT_ID}/users/me`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "user_updated" });
        }),
      );
      await client.account(ACCOUNT_ID).users.update("me", { headline: "x" });
      return captured!;
    },
  },
  {
    name: "users.listRelations",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/profiles/relations`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "relation_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).users.listRelations();
      return captured!;
    },
  },
  {
    name: "users.listFollowers",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/users/ACo1/followers`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "follower_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).users.listFollowers("ACo1");
      return captured!;
    },
  },
  {
    name: "users.listFollowing",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/users/ACo1/following`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "following_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).users.listFollowing("ACo1");
      return captured!;
    },
  },
  {
    name: "users.follow",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/users/ACo1/follow`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "user_followed" });
        }),
      );
      await client.account(ACCOUNT_ID).users.follow("ACo1");
      return captured!;
    },
  },
  {
    name: "users.unfollow",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.delete(`${BASE}/v1/${ACCOUNT_ID}/users/ACo1/follow`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "user_unfollowed" });
        }),
      );
      await client.account(ACCOUNT_ID).users.unfollow("ACo1");
      return captured!;
    },
  },
  {
    name: "users.getInMailCredits",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/inmail-credits`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "inmail_credits", credits: { classic: null, recruiter: null, sales_navigator: null } });
        }),
      );
      await client.account(ACCOUNT_ID).users.getInMailCredits();
      return captured!;
    },
  },
  {
    name: "users.endorseSkill",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/users/ACo1/endorse-skill`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "skill_endorsed" });
        }),
      );
      await client.account(ACCOUNT_ID).users.endorseSkill("ACo1", { endorsement_id: "e_1" });
      return captured!;
    },
  },

  // ─── Account-scoped: companies ──────────────────────────────────────────
  {
    name: "companies.get",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/companies/t-systems`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "company_profile", id: "1", name: "T-Systems" });
        }),
      );
      await client.account(ACCOUNT_ID).companies.get("t-systems");
      return captured!;
    },
  },
  {
    name: "companies.employees",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/companies/1/employees`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "company_employee_list", items: [], paging: { total_count: 0 }, cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).companies.employees("1");
      return captured!;
    },
  },
  {
    name: "companies.posts",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/companies/1/posts`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "company_post_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).companies.posts("1");
      return captured!;
    },
  },
  {
    name: "companies.jobs",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/companies/1/jobs`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "company_job_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).companies.jobs("1");
      return captured!;
    },
  },

  // ─── Account-scoped: search ─────────────────────────────────────────────
  {
    name: "search.getParameters",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/search/parameters`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "search_parameter_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).search.getParameters({ type: "SKILL", keywords: "eng" });
      return captured!;
    },
  },
  {
    name: "search.people",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/search/people`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "people_search_result", items: [], paging: { total_count: 0 }, cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).search.people({ keywords: "eng" });
      return captured!;
    },
  },
  {
    name: "search.companies",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/search/companies`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "company_search_result", items: [], paging: { total_count: 0 }, cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).search.companies({ keywords: "acme" });
      return captured!;
    },
  },
  {
    name: "search.posts",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/search/posts`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "post_search_result", items: [], paging: { total_count: 0 }, cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).search.posts({ keywords: "hiring" });
      return captured!;
    },
  },
  {
    name: "search.jobs",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/search/jobs`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "job_search_result", items: [], paging: { total_count: 0 }, cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).search.jobs({ keywords: "founder" });
      return captured!;
    },
  },
  {
    name: "search.fromUrl",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/search`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "search_result", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).search.fromUrl({ url: "https://www.linkedin.com/search/results/people/" });
      return captured!;
    },
  },

  // ─── Account-scoped: messaging ──────────────────────────────────────────
  {
    name: "messaging.listChats",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/chats`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "chat_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.listChats();
      return captured!;
    },
  },
  {
    name: "messaging.startChat",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/chats`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "chat_started", chat_id: "chat_1", message_id: "msg_1" }, { status: 201 });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.startChat({ attendees_ids: ["ACo1"], text: "hi" });
      return captured!;
    },
  },
  {
    name: "messaging.getChat",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "chat", id: "chat_1" });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.getChat("chat_1");
      return captured!;
    },
  },
  {
    name: "messaging.markChatRead",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.patch(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "chat_updated", chat_id: "chat_1", read: true });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.markChatRead("chat_1", { read: true });
      return captured!;
    },
  },
  {
    name: "messaging.listMessages",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "message_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.listMessages("chat_1");
      return captured!;
    },
  },
  {
    name: "messaging.sendMessage",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "message_sent", message_id: "msg_1" }, { status: 201 });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.sendMessage("chat_1", { text: "hi" });
      return captured!;
    },
  },
  {
    name: "messaging.getMessage",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages/msg_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "message", id: "msg_1" });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.getMessage("chat_1", "msg_1");
      return captured!;
    },
  },
  {
    name: "messaging.editMessage",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.patch(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages/msg_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "message_edited", message_id: "msg_1" });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.editMessage("chat_1", "msg_1", { text: "edited" });
      return captured!;
    },
  },
  {
    name: "messaging.deleteMessage",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.delete(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages/msg_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "message_deleted", message_id: "msg_1" });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.deleteMessage("chat_1", "msg_1");
      return captured!;
    },
  },
  {
    name: "messaging.addReaction",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages/msg_1/reactions`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "message_reaction_added", message_id: "msg_1", reaction: "👍" });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.addReaction("chat_1", "msg_1", { reaction: "👍" });
      return captured!;
    },
  },
  {
    name: "messaging.getAttachment",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/chats/chat_1/messages/msg_1/attachments/att_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return new HttpResponse(new Uint8Array([1]).buffer, {
            status: 200,
            headers: { "Content-Type": "application/octet-stream" },
          });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.getAttachment("chat_1", "msg_1", "att_1");
      return captured!;
    },
  },
  {
    name: "messaging.sendInMail",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/messages/inmail`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "inmail_sent", message_id: "msg_1", chat_id: "chat_1" }, { status: 201 });
        }),
      );
      await client.account(ACCOUNT_ID).messaging.sendInMail({
        recipient_urn: "urn:li:member:1",
        subject: "Hi",
        text: "Hello",
      });
      return captured!;
    },
  },

  // ─── Account-scoped: invites ─────────────────────────────────────────────
  {
    name: "invites.send",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/invites`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "invitation_sent", id: "SENT_1", status: "sent" }, { status: 201 });
        }),
      );
      await client.account(ACCOUNT_ID).invites.send({ recipient_identifier: "ACo1" });
      return captured!;
    },
  },
  {
    name: "invites.listSent",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/invites/sent`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "invitation_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).invites.listSent();
      return captured!;
    },
  },
  {
    name: "invites.listReceived",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/invites/received`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "invitation_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).invites.listReceived();
      return captured!;
    },
  },
  {
    name: "invites.accept",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/invites/received/inv_1/accept`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "invitation_accepted", invitation_id: "inv_1", status: "accepted" });
        }),
      );
      await client.account(ACCOUNT_ID).invites.accept("inv_1");
      return captured!;
    },
  },
  {
    name: "invites.decline",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/invites/received/inv_1/decline`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "invitation_declined", invitation_id: "inv_1", status: "declined" });
        }),
      );
      await client.account(ACCOUNT_ID).invites.decline("inv_1");
      return captured!;
    },
  },
  {
    name: "invites.cancel",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.delete(`${BASE}/v1/${ACCOUNT_ID}/invites/sent/inv_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "invitation_withdrawn", invitation_id: "inv_1", status: "withdrawn" });
        }),
      );
      await client.account(ACCOUNT_ID).invites.cancel("inv_1");
      return captured!;
    },
  },

  // ─── Account-scoped: posts (SDK-C2b) ────────────────────────────────────
  {
    name: "posts.listComments",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/posts/post_1/comments`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "comment_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).posts.listComments("post_1");
      return captured!;
    },
  },
  {
    name: "posts.get",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/posts/post_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "post", id: "post_1" });
        }),
      );
      await client.account(ACCOUNT_ID).posts.get("post_1");
      return captured!;
    },
  },
  {
    name: "posts.delete",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.delete(`${BASE}/v1/${ACCOUNT_ID}/posts/post_1`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await client.account(ACCOUNT_ID).posts.delete("post_1");
      return captured!;
    },
  },
  {
    name: "posts.create",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/posts`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "post_created", id: "post_1" }, { status: 201 });
        }),
      );
      await client.account(ACCOUNT_ID).posts.create({ text: "hi" });
      return captured!;
    },
  },
  {
    name: "posts.listUserPosts",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/users/me/posts`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "post_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).posts.listUserPosts("me");
      return captured!;
    },
  },
  {
    name: "posts.listReactions",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/posts/post_1/reactions`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "reaction_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).posts.listReactions("post_1");
      return captured!;
    },
  },
  {
    name: "posts.react",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.post(`${BASE}/v1/${ACCOUNT_ID}/posts/post_1/reactions`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "reaction_added", reaction: "like" });
        }),
      );
      await client.account(ACCOUNT_ID).posts.react("post_1", { reaction: "like" });
      return captured!;
    },
  },
  {
    name: "posts.unreact",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.delete(`${BASE}/v1/${ACCOUNT_ID}/posts/post_1/reactions`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "reaction_removed", reaction: "like" });
        }),
      );
      await client.account(ACCOUNT_ID).posts.unreact("post_1", { reaction: "like" });
      return captured!;
    },
  },
  {
    name: "posts.listUserReactions",
    scope: "account",
    run: async (client) => {
      let captured: CapturedRequest | undefined;
      server.use(
        http.get(`${BASE}/v1/${ACCOUNT_ID}/users/me/reactions`, ({ request }) => {
          const url = new URL(request.url);
          captured = { path: url.pathname, search: url.searchParams };
          return HttpResponse.json({ object: "reaction_list", items: [], cursor: null });
        }),
      );
      await client.account(ACCOUNT_ID).posts.listUserReactions("me");
      return captured!;
    },
  },

  // ─── Later chunks append their own account-scoped rows here (recruiter,
  // sales-navigator, jobs, comments). ───────────────────────────────────────
];

describe("path grammar — account-first for account-scoped, verbatim for root", () => {
  it.each(CASES.map((c): [string, PathGrammarCase] => [c.name, c]))("%s", async (_name, c) => {
    const client = new Curviate({ apiKey: "cvt_test_pathgrammar", baseUrl: BASE });
    const { path, search } = await c.run(client);

    if (c.scope === "account") {
      expect(path.startsWith(`/v1/${ACCOUNT_ID}/`)).toBe(true);
    } else {
      // Root-scoped: the account id (this bank never binds one via
      // `account(id)`) must never appear as the leading path segment.
      expect(path.startsWith(`/v1/${ACCOUNT_ID}/`)).toBe(false);
    }
    // account_id is never a query param — for either scope.
    expect(search.has("account_id")).toBe(false);
  });
});
