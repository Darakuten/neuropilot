import { describe, expect, it, beforeEach, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

const COMPANY = "co-1";
const PI = { id: "ag-pi", name: "PI", status: "idle", adapterType: "cursor", adapterConfig: { model: "claude-4.6-opus-high-thinking" } };
const ALL_AGENTS = [
  PI,
  { id: "ag-ideator", name: "Ideator", status: "idle", adapterType: "cursor" },
  { id: "ag-lit", name: "Lit Scout", status: "idle", adapterType: "cursor" },
  { id: "ag-exp", name: "Experimenter", status: "idle", adapterType: "cursor" },
  { id: "ag-critic", name: "Critic", status: "idle", adapterType: "cursor" },
  { id: "ag-writer", name: "Writer", status: "idle", adapterType: "cursor" },
];
const PROJECTS: Array<{ id: string; name: string }> = [
  { id: "proj-existing", name: "NeurIPS 2026" },
];
const PATCHED_ISSUES: Record<string, Record<string, unknown>> = {};
type IssueRecord = {
  id: string;
  title: string;
  status: string;
  assigneeAgentId: string | null;
  projectId: string | null;
  description?: string | null;
  blockedByIssueIds?: string[];
  blockedBy?: Array<{
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
  }>;
  identifier?: string;
};
const ISSUES: IssueRecord[] = [];
const COMMENTS: Record<
  string,
  Array<{
    id: string;
    body: string;
    authorAgentId: string | null;
    authorUserId: string | null;
    createdByRunId: string | null;
    createdAt: string;
  }>
> = {};

let nextId = 1;
function id(prefix: string) {
  return `${prefix}-${nextId++}`;
}

function summarizeIssue(issue: IssueRecord) {
  return {
    id: issue.id,
    identifier: issue.identifier ?? null,
    title: issue.title,
    status: issue.status,
    assigneeAgentId: issue.assigneeAgentId,
    assigneeUserId: null,
  };
}

function refreshIssueRelations() {
  for (const issue of ISSUES) {
    issue.blockedBy = (issue.blockedByIssueIds ?? [])
      .map((blockerId) => ISSUES.find((candidate) => candidate.id === blockerId))
      .filter((candidate): candidate is IssueRecord => Boolean(candidate))
      .map((candidate) => summarizeIssue(candidate));
  }
}

beforeEach(() => {
  PROJECTS.length = 1; // keep "NeurIPS 2026"
  ISSUES.length = 0;
  for (const k of Object.keys(COMMENTS)) delete COMMENTS[k];
  for (const k of Object.keys(PATCHED_ISSUES)) delete PATCHED_ISSUES[k];
  nextId = 100;

  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const u = url.replace(/^https?:\/\/[^/]+/, "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (u === `/api/companies/${COMPANY}/agents`)
      return j(ALL_AGENTS.map((a) => ({ ...a, role: "agent" })));
    if (u === `/api/agents/${PI.id}`) return j(PI);

    const issuePatchMatch = /^\/api\/issues\/([^/]+)$/.exec(u);
    if (issuePatchMatch && method === "PATCH") {
      PATCHED_ISSUES[issuePatchMatch[1]] = body;
      const issue = ISSUES.find((i) => i.id === issuePatchMatch[1]);
      if (issue) {
        Object.assign(issue, body);
        if (Array.isArray(body.blockedByIssueIds)) {
          issue.blockedByIssueIds = [...body.blockedByIssueIds];
        }
        refreshIssueRelations();
        return j(issue);
      }
      return j(body);
    }

    if (u === `/api/companies/${COMPANY}/projects` && method === "GET") return j(PROJECTS);
    if (u === `/api/companies/${COMPANY}/projects` && method === "POST") {
      const newProject = { id: id("proj"), name: body.name };
      PROJECTS.push(newProject);
      return j(newProject);
    }

    const issuesListMatch = /^\/api\/companies\/[^/]+\/issues(?:\?(.*))?$/.exec(u);
    if (issuesListMatch && method === "GET") {
      const params = new URLSearchParams(issuesListMatch[1] ?? "");
      const pid = params.get("projectId");
      if (pid) return j(ISSUES.filter((i) => i.projectId === pid));
      return j(ISSUES);
    }

    if (u === `/api/companies/${COMPANY}/issues` && method === "POST") {
      const newIssue: IssueRecord = {
        id: id("iss"),
        title: body.title,
        status: body.status ?? "todo",
        assigneeAgentId: body.assigneeAgentId,
        projectId: body.projectId,
        description: body.description ?? null,
        blockedByIssueIds: Array.isArray(body.blockedByIssueIds) ? [...body.blockedByIssueIds] : [],
        identifier: `DLR-${ISSUES.length + 1}`,
      };
      ISSUES.push(newIssue);
      refreshIssueRelations();
      COMMENTS[newIssue.id] = [];
      return j(newIssue);
    }

    const issueGetMatch = /^\/api\/issues\/([^/]+)$/.exec(u);
    if (issueGetMatch && method === "GET") {
      refreshIssueRelations();
      const issue = ISSUES.find((i) => i.id === issueGetMatch[1]);
      if (issue) return j(issue);
    }

    const commentsListMatch = /^\/api\/issues\/([^/]+)\/comments(\?|$)/.exec(u);
    if (commentsListMatch && method === "GET") {
      return j(COMMENTS[commentsListMatch[1]] ?? []);
    }
    if (commentsListMatch && method === "POST") {
      const comment = {
        id: id("c"),
        body: body.body,
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: null,
        createdAt: new Date().toISOString(),
      };
      COMMENTS[commentsListMatch[1]] = COMMENTS[commentsListMatch[1]] ?? [];
      COMMENTS[commentsListMatch[1]].push(comment);
      return j(comment);
    }

    if (u === `/api/agents/${PI.id}/wakeup` && method === "POST") {
      return j({ id: id("run"), status: "queued" });
    }
    if (u === `/api/agents/${PI.id}/resume` && method === "POST") {
      PI.status = "idle";
      return j(PI);
    }
    if (u === `/api/agents/${PI.id}/pause` && method === "POST") {
      PI.status = "paused";
      return j(PI);
    }

    if (u.startsWith(`/api/companies/${COMPANY}/heartbeat-runs`)) {
      return j([]);
    }

    return new Response(`not mocked: ${method} ${u}`, { status: 404 });
  });
});

function j(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dl-research-chat plugin", () => {
  it("bootstraps a discussion project + issue", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{
      issueId: string;
      projectId: string;
      piAgentId: string;
      piModel: string | null;
    }>("bootstrap", { companyId: COMPANY });
    expect(boot.issueId).toMatch(/iss-/);
    expect(boot.projectId).toMatch(/proj-/);
    expect(boot.piAgentId).toBe(PI.id);
    expect(boot.piModel).toBe("claude-4.6-opus-high-thinking");
    expect(PROJECTS.find((p) => p.name === "Research Discussion")).toBeTruthy();
    const issue = ISSUES.find((i) => i.id === boot.issueId);
    expect(issue?.status).toBe("todo");
  });

  it("returns chat payload after sending a message and wakes PI", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });

    const send = await harness.performAction<{ commentId: string; runId: string | null }>(
      "sendMessage",
      {
        companyId: COMPANY,
        issueId: boot.issueId,
        piAgentId: boot.piAgentId,
        body: "let's explore SSM vs LSTM on long-context tasks",
      },
    );
    expect(send.commentId).toMatch(/c-/);
    // No manual wake — server's comment-auto-wake handles it.
    expect(send.runId).toBeNull();

    const chat = await harness.getData<{
      messages: Array<{ authorKind: string; body: string }>;
      issueId: string;
      piModel: string | null;
    }>("chat", { companyId: COMPANY, issueId: boot.issueId });
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].authorKind).toBe("user");
    expect(chat.messages[0].body).toContain("SSM vs LSTM");
    expect(chat.piModel).toBe("claude-4.6-opus-high-thinking");
  });

  it("rejects empty messages", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    await expect(
      harness.performAction("sendMessage", {
        companyId: COMPANY,
        issueId: boot.issueId,
        piAgentId: boot.piAgentId,
        body: "  ",
      }),
    ).rejects.toThrow(/empty/);
  });

  it("formats comment with attachment block including local path + content URL + machine footer", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });

    const result = await harness.performAction<{
      commentId: string;
      runId: string | null;
      attachmentCount: number;
    }>("sendMessage", {
      companyId: COMPANY,
      issueId: boot.issueId,
      piAgentId: boot.piAgentId,
      body: "thoughts on this paper?",
      attachments: [
        {
          id: "att-1",
          originalFilename: "ssm-vs-lstm.pdf",
          contentType: "application/pdf",
          byteSize: 524288,
          objectKey: "co-1/issues/iss-1/2026/05/04/abc-ssm-vs-lstm.pdf",
          contentPath: "/api/attachments/att-1/content",
        },
      ],
    });

    expect(result.attachmentCount).toBe(1);
    expect(result.commentId).toMatch(/c-/);
    const comment = COMMENTS[boot.issueId][0];
    expect(comment.body).toContain("thoughts on this paper?");
    expect(comment.body).toContain("📎 **Attached files**");
    expect(comment.body).toContain("ssm-vs-lstm.pdf");
    expect(comment.body).toContain("co-1/issues/iss-1/2026/05/04/abc-ssm-vs-lstm.pdf");
    expect(comment.body).toContain("/api/attachments/att-1/content");
    expect(comment.body).toMatch(/<!--attachments:\[/);
    expect(comment.body).toContain("`pdf` skill");
  });

  it("requestCrystallization posts a structured prompt; PI is auto-woken by the comment, no manual wake", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    const result = await harness.performAction<{ commentId: string; runId: string | null }>(
      "requestCrystallization",
      { companyId: COMPANY, issueId: boot.issueId, piAgentId: boot.piAgentId, hint: "focus on baselines" },
    );
    expect(result.commentId).toMatch(/c-/);
    // We deliberately avoid manual wakeup to prevent Cursor session conflicts.
    // The server's comment-on-assigned-issue auto-wake handles it.
    expect(result.runId).toBeNull();
    const comment = COMMENTS[boot.issueId][0];
    expect(comment.body).toContain("Operator requests hypothesis crystallization");
    expect(comment.body).toContain("hypothesis-proposal");
    expect(comment.body).toContain("focus on baselines");
  });

  it("getChat parses a hypothesis-proposal fenced block out of PI comments and surfaces latestProposal", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    // Inject a PI-authored comment carrying a proposal block (simulating PI's emit).
    const piProposal = {
      version: 1,
      title: "[Theme] Test theme",
      hypothesis: "If X then Y because Z",
      successCriteria: ["metric M > T on benchmark B"],
      proposedProject: { mode: "create-new", name: "Test Project 2027" },
      childIssues: [
        { role: "Ideator", title: "[Idea] start", priority: "high" },
        { role: "Lit Scout", title: "[Lit] survey" },
        { role: "Experimenter", title: "[E-baselines] baselines", dependsOn: ["Lit Scout"] },
      ],
    };
    COMMENTS[boot.issueId] = [
      {
        id: "c-pi-1",
        body:
          "Quality bar met across all 5 checks. Proposal:\n\n```hypothesis-proposal\n" +
          JSON.stringify(piProposal, null, 2) +
          "\n```",
        authorAgentId: PI.id,
        authorUserId: null,
        createdByRunId: "run-fake",
        createdAt: new Date().toISOString(),
      },
    ];
    const chat = await harness.getData<{
      latestProposal: {
        messageId: string;
        promoted: boolean;
        proposal: { title: string; childIssues: unknown[] };
      } | null;
    }>("chat", { companyId: COMPANY, issueId: boot.issueId });
    expect(chat.latestProposal).not.toBeNull();
    expect(chat.latestProposal!.proposal.title).toBe("[Theme] Test theme");
    expect(chat.latestProposal!.proposal.childIssues).toHaveLength(3);
    expect(chat.latestProposal!.promoted).toBe(false);
  });

  it("getChat surfaces malformed hypothesis-proposal attempts for retry instead of failing silently", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    COMMENTS[boot.issueId] = [
      {
        id: "c-op-1",
        body: "crystallizeして",
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: null,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: "c-pi-bad-proposal",
        body: "品質バーは満たしました。\n\n~~~hypothesis-proposal\n\n  \"version\": 1\n~~~",
        authorAgentId: PI.id,
        authorUserId: null,
        createdByRunId: "run-bad",
        createdAt: new Date().toISOString(),
      },
    ];
    const chat = await harness.getData<{
      latestProposal: { messageId: string } | null;
      latestMalformedProposal: { messageId: string; raw: string } | null;
      messages: Array<{ id: string; proposalParseError?: { raw: string } }>;
    }>("chat", { companyId: COMPANY, issueId: boot.issueId });
    expect(chat.latestProposal).toBeNull();
    expect(chat.latestMalformedProposal?.messageId).toBe("c-pi-bad-proposal");
    expect(chat.latestMalformedProposal?.raw).toContain("\"version\": 1");
    const badMessage = chat.messages.find((m) => m.id === "c-pi-bad-proposal");
    expect(badMessage?.proposalParseError?.raw).toContain("\"version\": 1");
  });

  it("promoteTheme creates project + theme issue + parented child issues with blockedBy chains", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string }>("bootstrap", { companyId: COMPANY });

    const proposal = {
      version: 1,
      title: "[Theme] Submodular mask selection v2",
      summary: "Tighten mask selection to a submodular surrogate.",
      hypothesis: "If we replace L0 with a submodular surrogate, then selection is faster, because submodular minimization is poly-time.",
      successCriteria: ["wall-clock to convergence drops by ≥30% on CIFAR-10"],
      scope: { timeBudget: "2 weeks", computeBudget: "60 A100-h" },
      proposedProject: { mode: "create-new", name: "NeurIPS 2027 - Submodular masks", color: "#3a86ff" },
      childIssues: [
        { role: "Ideator", title: "[Idea] formalize submodular score", priority: "high", deliverable: "spec doc" },
        { role: "Lit Scout", title: "[Lit] competitor scan", priority: "high" },
        { role: "Experimenter", title: "[E-baselines] reproduce baselines", priority: "high", dependsOn: ["Lit Scout"] },
        { role: "Critic", title: "[Audit] number trace", priority: "medium", dependsOn: ["Experimenter"] },
        { role: "Writer", title: "[Write] paper draft", priority: "medium", dependsOn: ["Experimenter", "Critic"] },
      ],
    };

    const result = await harness.performAction<{
      themeIssueId: string;
      themeIssueIdentifier: string;
      projectName: string;
      projectCreated: boolean;
      childIssues: Array<{
        id: string;
        identifier: string;
        role: string;
        assigneeAgentId: string | null;
        blockedByCount: number;
      }>;
      unresolvedRoles: string[];
    }>("promoteTheme", {
      companyId: COMPANY,
      discussionIssueId: boot.issueId,
      proposal,
      approvedBy: "operator-test",
    });

    // project created
    expect(result.projectCreated).toBe(true);
    expect(result.projectName).toBe("NeurIPS 2027 - Submodular masks");
    const proj = PROJECTS.find((p) => p.name === "NeurIPS 2027 - Submodular masks");
    expect(proj).toBeTruthy();

    // theme issue created
    expect(result.themeIssueId).toMatch(/iss-/);
    const themeIssue = ISSUES.find((i) => i.id === result.themeIssueId);
    expect(themeIssue?.title).toBe("[Theme] Submodular mask selection v2");
    expect(themeIssue?.assigneeAgentId).toBe(PI.id);

    // 6 child issues = 5 from PI + 1 auto-appended [Publish] step
    expect(result.childIssues).toHaveLength(6);
    expect(result.unresolvedRoles).toHaveLength(0);
    const roleToAgent: Record<string, string> = {
      Ideator: "ag-ideator",
      "Lit Scout": "ag-lit",
      Experimenter: "ag-exp",
      Critic: "ag-critic",
      Writer: "ag-writer",
    };
    for (const c of result.childIssues) {
      expect(c.assigneeAgentId).toBe(roleToAgent[c.role]);
    }

    // The auto-appended publish step exists, is assigned to Writer, and depends on Writer's draft.
    const publishIssue = result.childIssues.find((c) => /\[Publish\]/.test(
      ISSUES.find((i) => i.id === c.id)?.title ?? "",
    ));
    expect(publishIssue).toBeTruthy();
    expect(publishIssue?.assigneeAgentId).toBe("ag-writer");
    expect(publishIssue?.blockedByCount).toBe(1);

    // dependency chains wired via PATCH
    const expIssueId = result.childIssues.find((c) => c.role === "Experimenter")!.id;
    // Writer appears twice (draft + publish); use the first which is the draft.
    const draftWriter = result.childIssues.find(
      (c) => c.role === "Writer" && /\[Write\]/.test(ISSUES.find((i) => i.id === c.id)?.title ?? ""),
    )!;
    expect(PATCHED_ISSUES[expIssueId]).toBeDefined();
    expect((PATCHED_ISSUES[expIssueId].blockedByIssueIds as string[]).length).toBe(1);
    expect((PATCHED_ISSUES[draftWriter.id].blockedByIssueIds as string[]).length).toBe(2);

    // confirmation comment posted on the discussion issue
    const lastDiscussionComment = COMMENTS[boot.issueId][COMMENTS[boot.issueId].length - 1];
    expect(lastDiscussionComment.body).toContain("Promoted to research theme");
    expect(lastDiscussionComment.body).toContain("operator-test");
    expect(lastDiscussionComment.body).toContain("NeurIPS 2027 - Submodular masks");
    expect(lastDiscussionComment.body).toContain("<!--research-chat-no-wake-->");
  });

  it("promoteTheme rejects malformed proposals", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string }>("bootstrap", { companyId: COMPANY });
    await expect(
      harness.performAction("promoteTheme", {
        companyId: COMPANY,
        discussionIssueId: boot.issueId,
        proposal: { version: 1, title: "missing hypothesis" }, // no hypothesis
      }),
    ).rejects.toThrow(/hypothesis required/);
  });

  it("promoteTheme reports unresolvedRoles when an agent name doesn't exist", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string }>("bootstrap", { companyId: COMPANY });
    const result = await harness.performAction<{ unresolvedRoles: string[] }>("promoteTheme", {
      companyId: COMPANY,
      discussionIssueId: boot.issueId,
      proposal: {
        version: 1,
        title: "[Theme] Imaginary roles",
        hypothesis: "If A then B because C",
        successCriteria: ["metric M"],
        proposedProject: { mode: "existing", projectId: "proj-existing" },
        childIssues: [{ role: "Ideator", title: "[Idea] go" }, { role: "Mentor", title: "[Mentor] guide" }],
      },
    });
    // Mentor was not in ALL_AGENTS for this test → unresolved
    expect(result.unresolvedRoles).toContain("Mentor");
    expect(result.unresolvedRoles).not.toContain("Ideator");
  });

  it("classifies messages by author: user board comments → user, agent comments → pi, system-notice → system", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    // Inject three comments of different shapes.
    const t = new Date().toISOString();
    COMMENTS[boot.issueId] = [
      // (a) operator-authored normal message
      { id: "c-u", body: "EEG弁別問題やりたい", authorAgentId: null, authorUserId: "local-board", createdByRunId: null, createdAt: t },
      // (b) agent-authored reply
      { id: "c-pi", body: "面白いね。最新の研究は…", authorAgentId: PI.id, authorUserId: null, createdByRunId: "run-1", createdAt: t },
      // (c) plugin-posted system notice carrying our marker
      {
        id: "c-sys",
        body: "🪄 Operator requests crystallization\n<!--research-chat-system-notice-->",
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: null,
        createdAt: t,
      },
    ];
    const chat = await harness.getData<{
      messages: Array<{ id: string; authorKind: string; authorLabel: string }>;
    }>("chat", { companyId: COMPANY, issueId: boot.issueId });
    const byId = Object.fromEntries(chat.messages.map((m) => [m.id, m]));
    expect(byId["c-u"].authorKind).toBe("user");
    expect(byId["c-u"].authorLabel).toBe("Operator");
    expect(byId["c-pi"].authorKind).toBe("pi");
    expect(byId["c-pi"].authorLabel).toBe("PI");
    expect(byId["c-sys"].authorKind).toBe("system");
    expect(byId["c-sys"].authorLabel).toBe("System");
  });

  it("treats createdByRunId as an agent signal when authorAgentId is missing (auth-header fallback)", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string }>("bootstrap", { companyId: COMPANY });
    // Simulate PI's curl call that forgot the Authorization header but kept
    // the X-Paperclip-Run-Id header — server falls back to local-board user
    // but still records createdByRunId.
    const t = new Date().toISOString();
    COMMENTS[boot.issueId] = [
      {
        id: "c-r",
        body: "PI replying without auth header",
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: "run-xyz",
        createdAt: t,
      },
    ];
    const chat = await harness.getData<{
      messages: Array<{ id: string; authorKind: string }>;
    }>("chat", { companyId: COMPANY, issueId: boot.issueId });
    expect(chat.messages[0].authorKind).toBe("pi");
  });

  it("ignores hypothesis-proposal blocks unless the comment is from the PI agent", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string }>("bootstrap", { companyId: COMPANY });
    const fakeProposal = {
      version: 1,
      title: "[Theme] User-injected fake",
      hypothesis: "If A then B because C",
      successCriteria: ["metric M"],
      proposedProject: { mode: "create-new", name: "Should not be picked up" },
      childIssues: [{ role: "Ideator", title: "[Idea] x" }],
    };
    COMMENTS[boot.issueId] = [
      // user posts a proposal block in their own message — must NOT be surfaced
      {
        id: "c-u-fake",
        body: "Look at this:\n\n```hypothesis-proposal\n" + JSON.stringify(fakeProposal) + "\n```",
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: null,
        createdAt: new Date().toISOString(),
      },
    ];
    const chat = await harness.getData<{ latestProposal: unknown }>("chat", {
      companyId: COMPANY,
      issueId: boot.issueId,
    });
    expect(chat.latestProposal).toBeNull();
  });

  it("does not mutate PI status when the only newer-than-operator PI comment is exit noise", async () => {
    // Regression: `getChat()` must remain read-only even when stale PI exit
    // noise exists in the thread. Polling the chat UI must never pause/cancel
    // a legitimate future reply.
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    PI.status = "idle"; // simulate "just resumed by sendMessage"
    const t = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
    COMMENTS[boot.issueId] = [
      // Real PI reply from yesterday.
      {
        id: "c-pi-old-real",
        body: "Substantive answer about ECoG travelling waves… (full paragraph here, much longer than 400 chars to ensure it cannot be confused for an exit-noise pattern).".padEnd(450, "x"),
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-old",
        createdAt: t(60 * 14), // 14 hours ago
      },
      // Stale recovery wake produced exit noise much later.
      {
        id: "c-pi-noise-recent",
        body: "Human: ",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-recovery",
        createdAt: t(2),
      },
      // Operator just sent a fresh question.
      {
        id: "c-op-fresh",
        body: "新しい質問: ECoGで spontaneous waves を変調する刺激は？",
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: null,
        createdAt: t(0.5),
      },
    ];
    const chat = await harness.getData<{ piAgentStatus: string }>("chat", {
      companyId: COMPANY,
      issueId: boot.issueId,
    });
    expect(chat.piAgentStatus).toBe("idle");
    expect(PI.status).toBe("idle");
  });

  it("filters PI 'exit noise' comments (e.g. 'サイレント終了') from the rendered messages", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    const t = (mins: number) =>
      new Date(Date.now() - mins * 60_000).toISOString();
    COMMENTS[boot.issueId] = [
      {
        id: "c-op-real",
        body: "ecogでのTravelling wavesの研究テーマを考えたい。いい研究仮説ある？",
        authorAgentId: null,
        authorUserId: "local-board",
        createdByRunId: null,
        createdAt: t(5),
      },
      // PI emits a stale-recovery exit-noise comment — must be hidden in UI.
      {
        id: "c-pi-noise-1",
        body: "チャットスレッド、新規オペレーターコメントなし。サイレント終了。",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-recovery-1",
        createdAt: t(4),
      },
      // PI's "I'm honoring Rule 0" meta-comment — also noise. Filter must
      // strip these too, otherwise PI's well-intentioned acknowledgments
      // pollute the chat.
      {
        id: "c-pi-noise-2",
        body: "`issue_continuation_needed` — システムウェイク、即時終了。",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-recovery-2",
        createdAt: t(3.5),
      },
      // Cursor adapter empty-completion bleed-through: model returned only a
      // role marker because the recovery-wake prompt had no user content.
      {
        id: "c-pi-noise-3",
        body: "Human: ",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-recovery-3",
        createdAt: t(3.2),
      },
      // Server-side recovery escalation (no author at all) — also noise.
      {
        id: "c-server-escalation",
        body: "Paperclip automatically retried continuation for this assigned `in_progress` issue during terminal run recovery, but it still has no progress…",
        authorAgentId: null,
        authorUserId: null,
        createdByRunId: null,
        createdAt: t(3),
      },
      {
        id: "c-pi-noise-4",
        body: "System-source on chat thread. Exiting with zero side effects.",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-recovery-4",
        createdAt: t(2.8),
      },
      {
        id: "c-pi-noise-5",
        body: "`issue_status_changed`, pending comments 0. Exiting with zero side effects.",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-recovery-5",
        createdAt: t(2.6),
      },
      // Real PI reply — must be visible.
      {
        id: "c-pi-real",
        body: "了解。ECoG での travelling waves について、まず vault を確認しますね。先行研究は Muller et al. 2018 (Nat Rev Neurosci) が出発点。一つだけ聞きたい：対象としているのは spontaneous waves か、stimulus-evoked か？",
        authorAgentId: boot.piAgentId,
        authorUserId: null,
        createdByRunId: "run-real",
        createdAt: t(2),
      },
    ];
    const chat = await harness.getData<{
      messages: Array<{ id: string; authorKind: string; body: string }>;
    }>("chat", { companyId: COMPANY, issueId: boot.issueId });
    const ids = chat.messages.map((m) => m.id);
    expect(ids).toContain("c-op-real");
    expect(ids).toContain("c-pi-real");
    expect(ids).not.toContain("c-pi-noise-1");
    expect(ids).not.toContain("c-pi-noise-2");
    expect(ids).not.toContain("c-pi-noise-3");
    expect(ids).not.toContain("c-pi-noise-4");
    expect(ids).not.toContain("c-pi-noise-5");
    expect(ids).not.toContain("c-server-escalation");
  });

  it("sendMessage respects a paused PI and only saves the operator comment", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    PI.status = "paused";
    const result = await harness.performAction<{ piPaused: boolean; runId: string | null }>(
      "sendMessage",
      {
        companyId: COMPANY,
        issueId: boot.issueId,
        piAgentId: boot.piAgentId,
        body: "are you there?",
      },
    );
    expect(PI.status).toBe("paused");
    expect(result.piPaused).toBe(true);
    expect(result.runId).toBeNull();
    const comment = COMMENTS[boot.issueId][0];
    expect(comment.body).toContain("are you there?");
    PI.status = "idle";
  });

  it("sendMessage normalizes a blocked discussion thread back to todo and clears stale recovery blockers", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });

    const recoveryIssue: IssueRecord = {
      id: "iss-recovery",
      title: "Recover stalled issue DLR-1",
      status: "blocked",
      assigneeAgentId: boot.piAgentId,
      projectId: ISSUES.find((i) => i.id === boot.issueId)?.projectId ?? null,
      identifier: "DLR-38",
      blockedByIssueIds: [],
    };
    ISSUES.push(recoveryIssue);

    const discussion = ISSUES.find((i) => i.id === boot.issueId)!;
    discussion.status = "blocked";
    discussion.blockedByIssueIds = [recoveryIssue.id];
    refreshIssueRelations();

    await harness.performAction("sendMessage", {
      companyId: COMPANY,
      issueId: boot.issueId,
      piAgentId: boot.piAgentId,
      body: "B案で行こう",
    });

    expect(PATCHED_ISSUES[boot.issueId]?.status).toBe("todo");
    expect(PATCHED_ISSUES[boot.issueId]?.blockedByIssueIds).toEqual([]);
    expect(PATCHED_ISSUES[recoveryIssue.id]?.status).toBe("done");
    expect(discussion.status).toBe("todo");
    expect(discussion.blockedBy ?? []).toEqual([]);
  });

  it("resumePI flips PI status to idle", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    PI.status = "paused";
    const result = await harness.performAction<{ status: string }>("resumePI", {
      piAgentId: PI.id,
    });
    expect(result.status).toBe("idle");
    expect(PI.status).toBe("idle");
  });

  it("resetDiscussion archives the old issue (renaming + completed) and creates a fresh one", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string }>("bootstrap", { companyId: COMPANY });
    const oldId = boot.issueId;

    const result = await harness.performAction<{
      newIssueId: string;
      newIssueIdentifier: string;
      archivedOld: boolean;
    }>("resetDiscussion", { companyId: COMPANY, oldIssueId: oldId });
    expect(result.archivedOld).toBe(true);
    expect(result.newIssueId).not.toBe(oldId);
    // PATCH should have been applied to the old issue
    const oldPatch = PATCHED_ISSUES[oldId];
    expect(oldPatch).toBeDefined();
    expect(String(oldPatch.title)).toMatch(/archived/);
    expect(oldPatch.status).toBe("completed");
    // New issue should exist with the canonical title
    const newIssue = ISSUES.find((i) => i.id === result.newIssueId);
    expect(newIssue?.title).toMatch(/Research hypothesis discussion/);
    expect(newIssue?.status).toBe("todo");
  });

  it("allows attachment-only messages (empty body)", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const boot = await harness.getData<{ issueId: string; piAgentId: string }>("bootstrap", {
      companyId: COMPANY,
    });
    const result = await harness.performAction<{ commentId: string; attachmentCount: number }>(
      "sendMessage",
      {
        companyId: COMPANY,
        issueId: boot.issueId,
        piAgentId: boot.piAgentId,
        body: "",
        attachments: [
          {
            id: "att-2",
            originalFilename: "notes.md",
            contentType: "text/markdown",
            byteSize: 1024,
            objectKey: "co-1/issues/iss-1/2026/05/04/xyz-notes.md",
            contentPath: "/api/attachments/att-2/content",
          },
        ],
      },
    );
    expect(result.attachmentCount).toBe(1);
    const comment = COMMENTS[boot.issueId][0];
    expect(comment.body.startsWith("(no message — attachments only)")).toBe(true);
  });
});
