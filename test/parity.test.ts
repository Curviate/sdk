// Public-surface bijection.
//
// The SDK must expose EXACTLY the intended public method surface — one method
// per served operation, no more, no fewer. This test pins that surface as a
// table (namespace -> exact method set), enumerates the real prototype methods
// on a constructed client, and asserts set-equality per namespace. A phantom
// (extra) public method fails by name; a missing method fails by name; the
// total must be 122 methods across 15 namespaces. A separate compile-time block
// proves every removed method is gone at the type level.
import { describe, expect, it } from "vitest";
import { Curviate } from "../src/index.js";

const client = new Curviate({ apiKey: "cvt_test_parity" });
const acc = client.account("acc_test");

// Root-scoped namespaces (hang off the root client only).
const ROOT_SURFACE: Record<string, readonly string[]> = {
  accounts: ["list", "get", "update", "disconnect"],
  auth: [
    "intent",
    "solveCheckpoint",
    "requestCheckpoint",
    "pollCheckpoint",
    "getSession",
  ],
  webhooks: ["create", "list", "listEvents", "get", "update", "delete"],
};

// Account-scoped namespaces (hang off account(id) only).
const ACCOUNT_SURFACE: Record<string, readonly string[]> = {
  users: [
    "get",
    "update",
    "listRelations",
    "listFollowers",
    "listFollowing",
    "follow",
    "unfollow",
    "getInMailCredits",
    "endorseSkill",
  ],
  companies: ["get", "employees", "posts", "jobs"],
  search: ["getParameters", "people", "companies", "posts", "jobs", "fromUrl"],
  messaging: [
    "listChats",
    "startChat",
    "getChat",
    "markChatRead",
    "listMessages",
    "sendMessage",
    "getMessage",
    "editMessage",
    "deleteMessage",
    "addReaction",
    "getAttachment",
    "sendInMail",
  ],
  comments: [
    "listUserComments",
    "create",
    "edit",
    "delete",
    "reply",
    "listReplies",
    "listReactions",
    "addReaction",
    "removeReaction",
  ],
  profile: ["subscription", "analytics", "visitors", "ssi"],
  groups: ["list", "get", "members"],
  posts: [
    "listComments",
    "get",
    "delete",
    "create",
    "listUserPosts",
    "listReactions",
    "react",
    "unreact",
    "listUserReactions",
  ],
  invites: ["send", "listSent", "listReceived", "accept", "decline", "cancel"],
  jobs: [
    "list",
    "create",
    "get",
    "update",
    "getBudget",
    "publish",
    "close",
    "listApplicants",
    "getApplicant",
    "downloadResume",
  ],
  recruiter: [
    "getProfile",
    "startChat",
    "searchPeople",
    "searchParameters",
    "searchTalentPool",
    "searchFromUrl",
    "listProjects",
    "getProject",
    "updateProject",
    "listPipeline",
    "getProjectJob",
    "createProjectJob",
    "getProjectJobBudget",
    "createJob",
    "listJobs",
    "getJob",
    "updateProjectJob",
    "publishJob",
    "closeJob",
    "saveCandidate",
    "listApplicants",
    "getApplicant",
    "downloadResume",
  ],
  salesNavigator: [
    "searchPeople",
    "searchCompanies",
    "getParameters",
    "startChat",
    "getProfile",
    "accountLists",
    "leadLists",
    "browseAccountList",
    "browseLeadList",
    "saveAccount",
    "saveLead",
    "searchFromUrl",
  ],
};

/** The real public methods on a resource instance's prototype. */
function ownMethods(instance: object): Set<string> {
  const proto = Object.getPrototypeOf(instance) as object;
  return new Set(
    Object.getOwnPropertyNames(proto).filter(
      (name) =>
        name !== "constructor" &&
        typeof (instance as Record<string, unknown>)[name] === "function",
    ),
  );
}

const rootInstances: Record<string, object> = {
  accounts: client.accounts,
  auth: client.auth,
  webhooks: client.webhooks,
};

const accountInstances: Record<string, object> = {
  users: acc.users,
  companies: acc.companies,
  search: acc.search,
  messaging: acc.messaging,
  comments: acc.comments,
  profile: acc.profile,
  groups: acc.groups,
  posts: acc.posts,
  invites: acc.invites,
  jobs: acc.jobs,
  recruiter: acc.recruiter,
  salesNavigator: acc.salesNavigator,
};

describe("namespace mounting", () => {
  it("root client exposes exactly {accounts, auth, webhooks}", () => {
    for (const ns of Object.keys(ROOT_SURFACE)) {
      expect(client, `root namespace ${ns}`).toHaveProperty(ns);
    }
    // None of the account-scoped namespaces leak onto the root client.
    for (const ns of Object.keys(ACCOUNT_SURFACE)) {
      expect(client, `${ns} must not be root-mounted`).not.toHaveProperty(ns);
    }
    // The old profiles name is gone at the root too.
    expect(client).not.toHaveProperty("profiles");
  });

  it("account(id) exposes exactly the 12 account-scoped namespaces", () => {
    expect(new Set(Object.keys(acc))).toEqual(new Set(Object.keys(ACCOUNT_SURFACE)));
    // Root-only namespaces and the retired profiles name are absent.
    for (const ns of ["accounts", "auth", "webhooks", "profiles"]) {
      expect(acc, `${ns} must not be account-mounted`).not.toHaveProperty(ns);
    }
  });
});

describe("per-namespace method bijection", () => {
  for (const [ns, expected] of Object.entries(ROOT_SURFACE)) {
    it(`root ${ns} exposes exactly its ${expected.length} methods`, () => {
      expect(ownMethods(rootInstances[ns]!)).toEqual(new Set(expected));
    });
  }
  for (const [ns, expected] of Object.entries(ACCOUNT_SURFACE)) {
    it(`account ${ns} exposes exactly its ${expected.length} methods`, () => {
      expect(ownMethods(accountInstances[ns]!)).toEqual(new Set(expected));
    });
  }
});

describe("total mapped surface", () => {
  it("the intended table sums to 122 methods across 15 namespaces", () => {
    const namespaces = [
      ...Object.values(ROOT_SURFACE),
      ...Object.values(ACCOUNT_SURFACE),
    ];
    expect(namespaces.length).toBe(15);
    const total = namespaces.reduce((n, methods) => n + methods.length, 0);
    expect(total).toBe(122);
  });

  it("the real runtime surface also sums to exactly 122", () => {
    const roots = Object.values(rootInstances).reduce(
      (n, inst) => n + ownMethods(inst).size,
      0,
    );
    const accounts = Object.values(accountInstances).reduce(
      (n, inst) => n + ownMethods(inst).size,
      0,
    );
    expect(roots + accounts).toBe(122);
  });
});

describe("removed methods are gone", () => {
  it("the 14 reverse-orphans (plus the split respond) do not exist at runtime", () => {
    const absent: Array<[object, string]> = [
      [client.accounts, "createConnectLink"],
      [client.accounts, "createReconnectLink"],
      [client.accounts, "reconnect"],
      [client.webhooks, "getStateDiff"],
      [acc.messaging, "syncChat"],
      [acc.messaging, "syncMessages"],
      [acc.posts, "list"],
      [acc.companies, "followers"],
      [acc.recruiter, "syncMessages"],
      [acc.recruiter, "addApplicant"],
      [acc.recruiter, "rejectApplicant"],
      [acc.recruiter, "solveJobCheckpoint"],
      [acc.salesNavigator, "syncMessages"],
      [acc.users, "getCompany"],
      [acc.invites, "respond"],
    ];
    for (const [instance, method] of absent) {
      expect(
        (instance as Record<string, unknown>)[method],
        `${method} must be undefined`,
      ).toBeUndefined();
    }
  });

  it("removed methods are also a compile-time type error", () => {
    // @ts-expect-error connect-link minting has no served operation
    void client.accounts.createConnectLink;
    // @ts-expect-error reconnect-link minting has no served operation
    void client.accounts.createReconnectLink;
    // @ts-expect-error reconnect has no served operation
    void client.accounts.reconnect;
    // @ts-expect-error webhook state diff has no served operation
    void client.webhooks.getStateDiff;
    // @ts-expect-error chat sync has no served operation
    void acc.messaging.syncChat;
    // @ts-expect-error message sync has no served operation
    void acc.messaging.syncMessages;
    // @ts-expect-error the orphaned post list has no served operation
    void acc.posts.list;
    // @ts-expect-error company followers has no served operation
    void acc.companies.followers;
    // @ts-expect-error recruiter message sync has no served operation
    void acc.recruiter.syncMessages;
    // @ts-expect-error recruiter add-applicant has no served operation
    void acc.recruiter.addApplicant;
    // @ts-expect-error recruiter reject-applicant has no served operation
    void acc.recruiter.rejectApplicant;
    // @ts-expect-error recruiter job-checkpoint solving has no served operation
    void acc.recruiter.solveJobCheckpoint;
    // @ts-expect-error sales-navigator message sync has no served operation
    void acc.salesNavigator.syncMessages;
    // @ts-expect-error getCompany was dropped when profiles became users
    void acc.users.getCompany;
    // @ts-expect-error the combined respond split into accept and decline
    void acc.invites.respond;
    // @ts-expect-error the profiles namespace was renamed to users
    void acc.profiles;
    expect(true).toBe(true);
  });
});
