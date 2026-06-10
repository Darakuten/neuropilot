import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import os from "node:os";
import path from "node:path";
import {
  buildChildIssueBody,
  buildThemeIssueBody,
  ensurePublishStep,
  extractProposalsFromBody,
  type HypothesisProposal,
  validateProposal,
} from "./worker/proposal-utils.js";

const API_BASE = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";

const DISCUSSION_PROJECT_NAME = "Research Discussion";
const DISCUSSION_ISSUE_TITLE = "Research hypothesis discussion (PI ↔ Operator)";
const DISCUSSION_RESTING_STATUS = "todo";
const DISCUSSION_RECOVERY_TITLE_PREFIX = "Recover stalled issue ";

// Default Paperclip storage root (matches resolveDefaultStorageDir in server/src/home-paths.ts).
// Override with PAPERCLIP_STORAGE_LOCAL_DIR if non-default.
const STORAGE_BASE_DIR =
  process.env.PAPERCLIP_STORAGE_LOCAL_DIR ??
  path.join(os.homedir(), ".paperclip", "instances", "default", "data", "storage");

type AttachmentRef = {
  id: string;
  originalFilename: string | null;
  contentType: string;
  byteSize: number;
  objectKey: string;
  contentPath: string;
};

type Issue = {
  id: string;
  title: string;
  status: string;
  parentId?: string | null;
  updatedAt?: string;
  assigneeAgentId: string | null;
  projectId: string | null;
  description?: string | null;
  blockedBy?: Array<{
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
  }>;
  blocks?: Array<{
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    assigneeAgentId: string | null;
    assigneeUserId: string | null;
  }>;
  identifier?: string | null;
};
// Real Paperclip comment shape (from GET /api/issues/:id/comments).
// There is NO `authorType` field — derive role from authorAgentId/authorUserId/createdByRunId.
type Comment = {
  id: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdByRunId: string | null;
  createdAt: string;
};
type Project = { id: string; name: string };
type Agent = { id: string; name: string; status: string; adapterType: string };
type HeartbeatRun = {
  id: string;
  agentId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  triggerDetail: string;
  invocationSource: string;
  usageJson: { model?: string | null; costUsd?: string | null } | null;
  contextSnapshot?: Record<string, unknown> | null;
};

type ChatPayload = {
  companyId: string;
  issueId: string;
  issueIdentifier: string;
  issueTitle: string;
  piAgentId: string;
  piAgentName: string;
  piAgentStatus: string;
  piModel: string | null;
  messages: ChatMessage[];
  activeRun: ActiveRun | null;
  /** Most recent (= latest) proposal in the thread, if any. UI uses this to
   * surface the "Approve & launch" action without scanning all messages. */
  latestProposal: {
    messageId: string;
    createdAt: string;
    proposal: HypothesisProposal;
    /** True if `promoteTheme` was already run for this exact proposal. */
    promoted: boolean;
  } | null;
  latestMalformedProposal: {
    messageId: string;
    createdAt: string;
    raw: string;
  } | null;
  researchCycle: ResearchCycleSummary | null;
  fetchedAt: string;
};

type ResearchCycleNode = {
  id: string;
  identifier: string;
  title: string;
  status: string;
  phase: number;
  progressPct: number;
  blockedBy: string[];
};

type ResearchCyclePhase = {
  phase: number;
  label: string;
  progressPct: number;
  terminalPct: number;
  total: number;
  done: number;
  cancelled: number;
  inFlight: number;
  blocked: number;
  todo: number;
};

type ResearchCycleSummary = {
  themeIssueId: string;
  themeIssueIdentifier: string;
  themeTitle: string;
  themeStatus: string;
  totalPhases: number;
  currentPhase: number;
  overallProgressPct: number;
  overallTerminalPct: number;
  totalNodeCount: number;
  doneNodeCount: number;
  cancelledNodeCount: number;
  phaseProgress: ResearchCyclePhase[];
  nodes: ResearchCycleNode[];
};
type ChatMessage = {
  id: string;
  authorKind: "user" | "pi" | "system";
  authorLabel: string;
  body: string;
  createdAt: string;
  proposals?: HypothesisProposal[];
  proposalParseError?: {
    raw: string;
  };
};
type ActiveRun = {
  id: string;
  status: string;
  startedAt: string | null;
  elapsedSec: number | null;
  triggerDetail: string;
  model: string | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    ...(init ?? {}),
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`API ${init?.method ?? "GET"} ${path} -> ${resp.status} ${resp.statusText} ${body.slice(0, 240)}`);
  }
  return (await resp.json()) as T;
}

async function findOrCreateDiscussionProject(companyId: string): Promise<Project> {
  const projects = await api<Project[]>(`/api/companies/${companyId}/projects`);
  const existing = projects.find((p) => p.name === DISCUSSION_PROJECT_NAME);
  if (existing) return existing;
  return await api<Project>(`/api/companies/${companyId}/projects`, {
    method: "POST",
    body: JSON.stringify({
      name: DISCUSSION_PROJECT_NAME,
      slug: "research-discussion",
      description:
        "Long-running discussion threads between the operator and PI used to crystallize research hypotheses before launching experiments.",
    }),
  });
}

async function findPI(companyId: string): Promise<Agent> {
  const agents = await api<Agent[]>(`/api/companies/${companyId}/agents`);
  const pi = agents.find((a) => a.name === "PI");
  if (!pi) throw new Error("PI agent not found in this company");
  return pi;
}

// Canonical chat issue body. Spelled out so PI sees the operating contract on
// every wake (skills + AGENTS.md guidance is the second line of defense).
const DISCUSSION_ISSUE_DESCRIPTION = [
  "## What this is",
  "",
  "**This is a long-lived chat surface between the operator and PI.** It is",
  "NOT a normal task issue. PI must treat each new operator comment as a turn",
  "in a Slack-like conversation.",
  "",
  "## Hard rules for PI on this issue",
  "",
  "1. **Reply conversationally and briefly.** Never emit a `governance",
  "   summary`, `trigger`, `decision`, `next action`, or run-id explanation.",
  "   The operator does not want an audit log; they want a chat reply.",
  "2. **Only reply when there is a new operator question or attachment.**",
  "   If the latest comment is your own, or a system notice, exit silently.",
  "3. **Never change this issue's status.** Do not move it to `blocked`,",
  "   `done`, `cancelled`, or `in_review`. The operator owns the lifecycle.",
  "4. **Never create a recovery issue for this thread.** Wake-loops on this",
  "   issue mean an upstream auth/skill bug — surface it once in a comment",
  "   and stop, do not spawn `[Recovery]` issues.",
  "5. **Do not delegate from this issue.** Crystallize first via",
  "   `hypothesis-proposal`; the chat UI's Approve & launch button creates",
  "   the project and child issues.",
  "",
  "## How to reply",
  "",
  "Follow the `research-discussion` skill (Turn 1..N). Short paragraphs,",
  "vault citations via `vault-reader`, web citations via `web-research`,",
  "attachment reads via the right per-format skill (`pdf`/`docx`/`xlsx`/etc).",
  "",
  "Do not delete this issue — it is the canonical chat thread.",
].join("\n");

async function findOrCreateDiscussionIssue(
  companyId: string,
  projectId: string,
  piAgentId: string,
): Promise<Issue> {
  // Look across ALL statuses — including done/cancelled. Without
  // `includeCompleted=true` the API skips terminal-state issues and we end up
  // creating a fresh duplicate every time PI accidentally closes the thread.
  const issues = await api<Issue[]>(
    `/api/companies/${companyId}/issues?projectId=${projectId}&includeCompleted=true`,
  );
  // Prefer the canonical title (without the "[archived duplicate]" prefix
  // we use when cleaning up). Pick the lowest-numbered identifier for
  // stability when multiple historical duplicates exist.
  const candidates = issues
    .filter((i) => i.title === DISCUSSION_ISSUE_TITLE)
    .sort((a, b) => {
      const ai = parseInt(((a as Issue & { identifier?: string }).identifier ?? "").replace(/\D/g, ""), 10) || Number.MAX_SAFE_INTEGER;
      const bi = parseInt(((b as Issue & { identifier?: string }).identifier ?? "").replace(/\D/g, ""), 10) || Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  const existing = candidates[0];
  if (existing) {
    // Keep the chat thread in a resting `todo` state between turns. This
    // matches Paperclip's semantics better than leaving the issue in
    // `in_progress` with no live execution path, which would trigger
    // continuation recovery and eventually create bogus recovery blockers.
    try {
      return await normalizeDiscussionIssueForTurn({
        companyId,
        issueId: existing.id,
        piAgentId,
      });
    } catch {
      return existing;
    }
  }
  return await api<Issue>(`/api/companies/${companyId}/issues`, {
    method: "POST",
    body: JSON.stringify({
      projectId,
      title: DISCUSSION_ISSUE_TITLE,
      description: DISCUSSION_ISSUE_DESCRIPTION,
      status: DISCUSSION_RESTING_STATUS,
      priority: "high",
      assigneeAgentId: piAgentId,
    }),
  });
}

async function bootstrap(companyId: string): Promise<{
  companyId: string;
  issueId: string;
  projectId: string;
  piAgentId: string;
  piModel: string | null;
}> {
  const [project, pi] = await Promise.all([
    findOrCreateDiscussionProject(companyId),
    findPI(companyId),
  ]);
  const issue = await findOrCreateDiscussionIssue(companyId, project.id, pi.id);
  // best-effort fetch model from agent config
  const agentDetail = await api<{ adapterConfig?: { model?: string } }>(`/api/agents/${pi.id}`);
  return {
    companyId,
    issueId: issue.id,
    projectId: project.id,
    piAgentId: pi.id,
    piModel: agentDetail.adapterConfig?.model ?? null,
  };
}

function readIssueIdFromRun(run: HeartbeatRun): string | null {
  const snapshot = run.contextSnapshot;
  if (!snapshot || typeof snapshot !== "object") return null;
  return typeof snapshot.issueId === "string" ? snapshot.issueId : null;
}

async function getRecentRuns(companyId: string, piAgentId: string, limit = 5): Promise<HeartbeatRun[]> {
  try {
    return await api<HeartbeatRun[]>(
      `/api/companies/${companyId}/heartbeat-runs?agentId=${piAgentId}&limit=${limit}`,
    );
  } catch {
    return [];
  }
}

function toActiveRun(run: HeartbeatRun): ActiveRun {
  const elapsed =
    run.startedAt != null
      ? Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000)
      : null;
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    elapsedSec: elapsed,
    triggerDetail: run.triggerDetail,
    model: run.usageJson?.model ?? null,
  };
}

async function getLiveIssueRun(
  companyId: string,
  piAgentId: string,
  issueId: string,
): Promise<ActiveRun | null> {
  const runs = await getRecentRuns(companyId, piAgentId);
  const live = runs.find(
    (r) =>
      (r.status === "running" || r.status === "queued") &&
      readIssueIdFromRun(r) === issueId,
  );
  return live ? toActiveRun(live) : null;
}

function isDoneStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "done" || s === "completed";
}

function isCancelledStatus(status: string): boolean {
  return status.toLowerCase() === "cancelled";
}

function isTerminalStatus(status: string): boolean {
  const s = status.toLowerCase();
  return isDoneStatus(s) || isCancelledStatus(s);
}

function statusProgressPct(status: string): number {
  const s = status.toLowerCase();
  if (isDoneStatus(s)) return 100;
  if (isCancelledStatus(s)) return 0;
  if (s === "in_review") return 85;
  if (s === "in_progress" || s === "running") return 60;
  if (s === "blocked") return 25;
  return 0;
}

function phaseLabel(phase: number): string {
  if (phase === 1) return "Phase 1: Preparation";
  if (phase === 2) return "Phase 2: Build";
  if (phase === 3) return "Phase 3: Validation";
  return `Phase ${phase}`;
}

async function getResearchCycleSummary(companyId: string): Promise<ResearchCycleSummary | null> {
  try {
    const allIssues = await api<Array<Issue & { identifier?: string }>>(
      `/api/companies/${companyId}/issues?limit=500&includeCompleted=true`,
    );
    const rootThemes = allIssues.filter(
      (issue) => issue.parentId == null && issue.title.startsWith("[Theme]"),
    );
    if (rootThemes.length === 0) return null;

    const statusRank = (status: string): number => {
      const s = status.toLowerCase();
      if (s === "in_progress" || s === "in_review") return 0;
      if (s === "blocked") return 1;
      if (s === "todo" || s === "backlog") return 2;
      return 3;
    };

    rootThemes.sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r !== 0) return r;
      const ta = Date.parse(a.updatedAt ?? "") || 0;
      const tb = Date.parse(b.updatedAt ?? "") || 0;
      return tb - ta;
    });
    const theme = rootThemes[0];

    const childrenByParent = new Map<string, Array<Issue & { identifier?: string }>>();
    for (const issue of allIssues) {
      if (!issue.parentId) continue;
      const arr = childrenByParent.get(issue.parentId) ?? [];
      arr.push(issue);
      childrenByParent.set(issue.parentId, arr);
    }

    const descendants: Array<Issue & { identifier?: string }> = [];
    const q = [...(childrenByParent.get(theme.id) ?? [])];
    while (q.length > 0) {
      const next = q.shift();
      if (!next) continue;
      descendants.push(next);
      const childNodes = childrenByParent.get(next.id) ?? [];
      q.push(...childNodes);
    }

    if (descendants.length === 0) {
      return {
        themeIssueId: theme.id,
        themeIssueIdentifier: theme.identifier ?? "",
        themeTitle: theme.title,
        themeStatus: theme.status,
        totalPhases: 1,
        currentPhase: 1,
        overallProgressPct: statusProgressPct(theme.status),
        overallTerminalPct: isTerminalStatus(theme.status) ? 100 : 0,
        totalNodeCount: 1,
        doneNodeCount: isDoneStatus(theme.status) ? 1 : 0,
        cancelledNodeCount: isCancelledStatus(theme.status) ? 1 : 0,
        phaseProgress: [
          {
            phase: 1,
            label: phaseLabel(1),
            progressPct: statusProgressPct(theme.status),
            terminalPct: isTerminalStatus(theme.status) ? 100 : 0,
            total: 1,
            done: isDoneStatus(theme.status) ? 1 : 0,
            cancelled: isCancelledStatus(theme.status) ? 1 : 0,
            inFlight: theme.status === "in_progress" || theme.status === "in_review" ? 1 : 0,
            blocked: theme.status === "blocked" ? 1 : 0,
            todo: theme.status === "todo" || theme.status === "backlog" ? 1 : 0,
          },
        ],
        nodes: [],
      };
    }

    const detailedDescendants = await Promise.all(
      descendants.map((child) => api<Issue & { identifier?: string }>(`/api/issues/${child.id}`)),
    );
    const nodeIdSet = new Set(detailedDescendants.map((child) => child.id));
    const byId = new Map(detailedDescendants.map((child) => [child.id, child]));

    const depsById = new Map<string, string[]>();
    for (const child of detailedDescendants) {
      const deps = (child.blockedBy ?? [])
        .map((dep) => dep.id)
        .filter((depId) => nodeIdSet.has(depId));
      depsById.set(child.id, deps);
    }

    const hierarchyDepthMemo = new Map<string, number>();
    const hierarchyDepthOf = (id: string): number => {
      const cached = hierarchyDepthMemo.get(id);
      if (cached != null) return cached;
      const node = byId.get(id);
      if (!node) return 1;
      if (!node.parentId || node.parentId === theme.id || !byId.has(node.parentId)) {
        hierarchyDepthMemo.set(id, 1);
        return 1;
      }
      const depth = 1 + hierarchyDepthOf(node.parentId);
      hierarchyDepthMemo.set(id, depth);
      return depth;
    };

    const depthMemo = new Map<string, number>();
    const visiting = new Set<string>();
    const depthOf = (id: string): number => {
      const cached = depthMemo.get(id);
      if (cached != null) return cached;
      if (visiting.has(id)) return 1;
      visiting.add(id);
      const deps = depsById.get(id) ?? [];
      const depDepth = deps.length === 0 ? 1 : 1 + Math.max(...deps.map((depId) => depthOf(depId)));
      const depth = Math.max(hierarchyDepthOf(id), depDepth);
      visiting.delete(id);
      depthMemo.set(id, depth);
      return depth;
    };

    const nodes: ResearchCycleNode[] = detailedDescendants
      .map((child) => ({
        id: child.id,
        identifier: child.identifier ?? "",
        title: child.title,
        status: child.status,
        phase: depthOf(child.id),
        progressPct: statusProgressPct(child.status),
        blockedBy: depsById.get(child.id) ?? [],
      }))
      .sort((a, b) => a.phase - b.phase || a.title.localeCompare(b.title));

    const totalPhases = Math.max(...nodes.map((node) => node.phase), 1);
    const phaseProgress: ResearchCyclePhase[] = [];
    for (let phase = 1; phase <= totalPhases; phase++) {
      const phaseNodes = nodes.filter((node) => node.phase === phase);
      const total = phaseNodes.length;
      const done = phaseNodes.filter((node) => isDoneStatus(node.status)).length;
      const cancelled = phaseNodes.filter((node) => isCancelledStatus(node.status)).length;
      const terminal = done + cancelled;
      const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
      const terminalPct = total === 0 ? 0 : Math.round((terminal / total) * 100);
      const inFlight = phaseNodes.filter(
        (node) => node.status === "in_progress" || node.status === "in_review",
      ).length;
      const blocked = phaseNodes.filter((node) => node.status === "blocked").length;
      const todo = phaseNodes.filter(
        (node) => node.status === "todo" || node.status === "backlog",
      ).length;
      phaseProgress.push({
        phase,
        label: phaseLabel(phase),
        progressPct,
        terminalPct,
        total,
        done,
        cancelled,
        inFlight,
        blocked,
        todo,
      });
    }

    const doneNodeCount = nodes.filter((node) => isDoneStatus(node.status)).length;
    const cancelledNodeCount = nodes.filter((node) => isCancelledStatus(node.status)).length;
    const totalNodeCount = Math.max(nodes.length, 1);
    const overallProgressPct = Math.round((doneNodeCount / totalNodeCount) * 100);
    const overallTerminalPct = Math.round(((doneNodeCount + cancelledNodeCount) / totalNodeCount) * 100);
    const currentPhase =
      phaseProgress.find((phase) => phase.done < phase.total)?.phase ?? totalPhases;

    return {
      themeIssueId: theme.id,
      themeIssueIdentifier: theme.identifier ?? "",
      themeTitle: theme.title,
      themeStatus: theme.status,
      totalPhases,
      currentPhase,
      overallProgressPct,
      overallTerminalPct,
      totalNodeCount,
      doneNodeCount,
      cancelledNodeCount,
      phaseProgress,
      nodes,
    };
  } catch {
    return null;
  }
}

function isDiscussionRecoveryIssue(issue: Pick<Issue, "title"> | null | undefined): boolean {
  return typeof issue?.title === "string" && issue.title.startsWith(DISCUSSION_RECOVERY_TITLE_PREFIX);
}

async function resolveDiscussionRecoveryArtifacts(
  issue: Issue,
  sourceIssueId: string,
): Promise<void> {
  const blockers = issue.blockedBy ?? [];
  for (const blocker of blockers) {
    if (!isDiscussionRecoveryIssue(blocker)) continue;
    try {
      await api(`/api/issues/${blocker.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "done",
          comment:
            `Auto-resolved by Research Chat normalization. ${DISCUSSION_ISSUE_TITLE} is returning to ` +
            `its resting chat state (\`${DISCUSSION_RESTING_STATUS}\`) so this recovery blocker no longer owns the next action.`,
        }),
      });
    } catch {
      // best-effort cleanup; the source issue patch below is what actually
      // restores the thread's live execution path.
    }
  }

  // Recovery artifacts on the canonical discussion thread are invalid by
  // contract: the chat thread should never be blocked by child recovery work.
  // Even if Paperclip created one before our plugin fix, the next operator
  // interaction should snap the thread back to a clean resting state.
  if (blockers.length > 0) {
    try {
      await api(`/api/issues/${sourceIssueId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: DISCUSSION_RESTING_STATUS,
          blockedByIssueIds: [],
        }),
      });
    } catch {
      // ignore; caller already attempted the same normalization patch
    }
  }
}

async function normalizeDiscussionIssueForTurn(input: {
  companyId: string;
  issueId: string;
  piAgentId: string;
}): Promise<Issue> {
  const issue = await api<Issue>(`/api/issues/${input.issueId}`);
  const liveRun = await getLiveIssueRun(input.companyId, input.piAgentId, input.issueId);

  const patch: Record<string, unknown> = {};
  if (issue.assigneeAgentId !== input.piAgentId) {
    patch.assigneeAgentId = input.piAgentId;
  }
  if ((issue.description ?? "") !== DISCUSSION_ISSUE_DESCRIPTION) {
    patch.description = DISCUSSION_ISSUE_DESCRIPTION;
  }
  if ((issue.blockedBy?.length ?? 0) > 0) {
    // The canonical research chat thread should never be blocked by first-class
    // issue dependencies. If it is, those blockers are stale recovery artifacts.
    patch.blockedByIssueIds = [];
  }
  if (
    !liveRun &&
    (issue.status === "blocked" ||
      issue.status === "done" ||
      issue.status === "cancelled" ||
      issue.status === "in_progress")
  ) {
    patch.status = DISCUSSION_RESTING_STATUS;
  }

  const normalized =
    Object.keys(patch).length > 0
      ? await api<Issue>(`/api/issues/${input.issueId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        })
      : issue;

  if (!liveRun) {
    await resolveDiscussionRecoveryArtifacts(issue, input.issueId);
  }

  return normalized;
}

// Marker we embed in comments that this plugin posts on the operator's behalf
// (e.g. the "🪄 Operator requests crystallization" prompt). These come back
// from the API as user-authored comments, but UX-wise they should render as
// system notices, not as the operator's own messages.
const SYSTEM_NOTICE_MARKER = "<!--research-chat-system-notice-->";
const NO_WAKE_SYSTEM_NOTICE_MARKER = "<!--research-chat-no-wake-->";

function isSystemNotice(body: string): boolean {
  return body.includes(SYSTEM_NOTICE_MARKER);
}

// PI is *supposed* to "exit silently" when a stale recovery wake fires, but it
// keeps posting meta-comments about that ("サイレント終了", "新規オペレーター
// コメントなし", "自分の前回返信の再トリガー", auth-warning rambles, etc.).
// These pollute the chat and look like the bot is broken.
//
// We hide them from the UI so the operator only sees substantive PI turns.
// They still remain in the raw issue comment stream because Paperclip stores
// them, but the chat surface must suppress this noise entirely.
const PI_EXIT_NOISE_PATTERNS: RegExp[] = [
  /サイレント終了/,
  /即時終了/,
  /新規オペレーターコメントなし/,
  /自分の前回(コメント|返信)の?再?トリガー/,
  /チャットスレッド[、,].*?サイレント/,
  /システム.?ウェイク/,
  /システム[ーー]?ソース.?ウェイク/,
  /System-source/i,
  /issue_status_changed/i,
  /issue_continuation_needed/i,
  /issue\.productive_terminal_continuation_recovery/i,
  /issue_assignment_recovery/i,
  /zero side effects/i,
  /pending comments\s+\d+/i,
  /PAPERCLIP_WAKE_REASON/, // PI quoting its own env-var rule back
  /No\s+new\s+operator\s+comment[s]?/i,
  /Silent(ly)?\s+exit(ing|ed)?/i,
  /Stale\s+wake/i,
  /Recovery\s+wake/i,
  /^Paperclip automatically retried continuation/m, // server-side recovery escalation noise
  /PAPERCLIP_API_KEY未設定/,
  /local-board\s*(として|として記録)/,
  /^\s*\(PIエージェントとして:/, // PI talking about itself in 3rd person
  // Cursor adapter sometimes returns just a Claude role marker ("Human:" /
  // "Assistant:" / "User:") when the model produces an empty completion
  // (e.g. a recovery wake with no real user content in the prompt). These
  // are pure noise and must be hidden.
  /^\s*(Human|Assistant|User)\s*:\s*$/m,
];

// Even shorter substantive replies sometimes leak through (e.g. "了解" — 2
// bytes — IS a legitimate ack we want to keep). But anything matching the
// noise patterns OR pure whitespace under 8 chars is treated as noise.
function isLikelyEmptyReply(body: string): boolean {
  const trimmed = (body || "").trim();
  if (trimmed.length === 0) return true;
  // A single role marker like "Human" or "Assistant" with no actual content.
  if (/^(Human|Assistant|User)\s*:?\s*$/.test(trimmed)) return true;
  return false;
}

function isPIExitNoise(c: Comment, piAgentId: string): boolean {
  const kind = classifyAuthor(c, piAgentId);
  if (kind !== "pi") {
    // Server-side automatic continuation escalation has no author at all but
    // is the same kind of noise (the "Paperclip automatically retried…" post).
    if (
      c.authorAgentId == null &&
      c.authorUserId == null &&
      c.createdByRunId == null &&
      PI_EXIT_NOISE_PATTERNS.some((re) => re.test(c.body || ""))
    ) {
      return true;
    }
    return false;
  }
  const body = c.body || "";
  // Empty completions ("Human:" / "Assistant:" alone) are always noise even
  // before any pattern matching.
  if (isLikelyEmptyReply(body)) return true;
  const trimmed = body.trim();
  // Hard cap: a PI message under 400 chars that matches any exit-noise pattern
  // is treated as noise. Real replies are virtually always longer than this and
  // talk about substance, not the heartbeat lifecycle.
  if (trimmed.length > 400) return false;
  return PI_EXIT_NOISE_PATTERNS.some((re) => re.test(trimmed));
}

function classifyAuthor(c: Comment, piAgentId: string): "user" | "pi" | "system" {
  // 1) Comments emitted by an agent during a heartbeat run → agent message.
  //    Treat the assigned PI agent's comments as "pi"; any other agent we
  //    still surface as "pi" so cross-agent traffic is at least visible.
  if (c.authorAgentId) {
    return c.authorAgentId === piAgentId ? "pi" : "pi";
  }
  // 2) Fallback for agent comments that came in without the Authorization
  //    header (e.g. PI's curl invocation forgot Bearer): if `createdByRunId`
  //    is set the comment was emitted from inside a heartbeat run, so it is
  //    an agent message even though the server attributed it to the board
  //    user as a fallback. Without this rule, PI's replies appear as
  //    "Operator" until PI corrects its API call.
  if (c.createdByRunId) return "pi";
  // 3) Comments authored by a board user that carry our system-notice marker
  //    are plugin-side prompts (crystallization request, promotion confirm,
  //    etc.) — render as system, not as the operator.
  if (c.authorUserId && isSystemNotice(c.body)) {
    return "system";
  }
  // 4) Plain board-user comment.
  if (c.authorUserId) return "user";
  // 5) Fallback (no author at all — shouldn't happen but be safe).
  return "system";
}

function authorLabel(c: Comment, kind: "user" | "pi" | "system"): string {
  if (kind === "user") return "Operator";
  if (kind === "system") return "System";
  // PI / agent
  return "PI";
}

async function getChat(input: { companyId: string; issueId?: string }): Promise<ChatPayload> {
  const companyId = input.companyId;
  let issueId = input.issueId;
  let piAgentId: string;
  let piModel: string | null = null;
  if (!issueId) {
    const boot = await bootstrap(companyId);
    issueId = boot.issueId;
    piAgentId = boot.piAgentId;
    piModel = boot.piModel;
  } else {
    const pi = await findPI(companyId);
    piAgentId = pi.id;
    const ad = await api<{ adapterConfig?: { model?: string } }>(`/api/agents/${pi.id}`);
    piModel = ad.adapterConfig?.model ?? null;
  }
  const [issue, commentsRaw, piAgent] = await Promise.all([
    api<Issue & { identifier?: string }>(`/api/issues/${issueId}`),
    api<Comment[]>(`/api/issues/${issueId}/comments?limit=200`),
    api<Agent>(`/api/agents/${piAgentId}`),
  ]);

  // The Paperclip API returns comments newest-first by default; chat UIs
  // expect oldest-first (newest at the bottom). Normalize here so every
  // downstream consumer (UI, tests, the proposal extractor) can treat
  // `messages[messages.length - 1]` as the most recent turn.
  const comments = [...commentsRaw].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
    return ta - tb;
  });

  const messages: ChatMessage[] = comments
    .filter((c) => !isPIExitNoise(c, piAgentId))
    .map((c) => {
      const kind = classifyAuthor(c, piAgentId);
      // Only PI may emit a binding hypothesis proposal. If the operator (or a
      // test fixture) happens to post a JSON block in their message, ignore it
      // for the purposes of the Proposal Card — otherwise stale text could
      // accidentally trigger a "approve & launch" affordance.
      const { proposals, malformedBlocks } = kind === "pi"
        ? extractProposalsFromBody(c.body)
        : { proposals: [], malformedBlocks: [] as string[] };
      return {
        id: c.id,
        authorKind: kind,
        authorLabel: authorLabel(c, kind),
        body: c.body,
        createdAt: c.createdAt,
        proposals: proposals.length > 0 ? proposals : undefined,
        proposalParseError:
          proposals.length === 0 && malformedBlocks.length > 0
            ? { raw: malformedBlocks[0] }
            : undefined,
      };
    });

  // Determine latest proposal across all messages and whether a "Promoted to
  // research theme" confirmation comment has been posted after it.
  let latestProposal: ChatPayload["latestProposal"] = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.proposals && m.proposals.length > 0) {
      const promoted = messages
        .slice(i + 1)
        .some((m2) => m2.body.includes("✅ **Promoted to research theme**"));
      latestProposal = {
        messageId: m.id,
        createdAt: m.createdAt,
        proposal: m.proposals[m.proposals.length - 1],
        promoted,
      };
      break;
    }
  }

  let latestMalformedProposal: ChatPayload["latestMalformedProposal"] = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.proposalParseError) {
      latestMalformedProposal = {
        messageId: m.id,
        createdAt: m.createdAt,
        raw: m.proposalParseError.raw,
      };
      break;
    }
  }
  if (
    latestProposal &&
    latestMalformedProposal &&
    new Date(latestProposal.createdAt).getTime() >= new Date(latestMalformedProposal.createdAt).getTime()
  ) {
    latestMalformedProposal = null;
  }

  // Active heartbeat run for PI on *this exact issue* only.
  const activeRun = await getLiveIssueRun(companyId, piAgentId, issueId);
  const researchCycle = await getResearchCycleSummary(companyId);

  return {
    companyId,
    issueId,
    issueIdentifier: (issue as { identifier?: string }).identifier ?? "",
    issueTitle: issue.title,
    piAgentId,
    piAgentName: piAgent.name,
    piAgentStatus: piAgent.status,
    piModel,
    messages,
    activeRun,
    latestProposal,
    latestMalformedProposal,
    researchCycle,
    fetchedAt: new Date().toISOString(),
  };
}

function localPathFor(att: AttachmentRef): string {
  // Trim leading slashes from objectKey defensively.
  const cleanKey = att.objectKey.replace(/^\/+/, "");
  return path.join(STORAGE_BASE_DIR, cleanKey);
}

function buildAttachmentBlock(attachments: AttachmentRef[]): string {
  if (attachments.length === 0) return "";

  const lines: string[] = [];
  lines.push("");
  lines.push("📎 **Attached files** — read these before replying:");
  lines.push("");
  for (const a of attachments) {
    const name = a.originalFilename ?? "(untitled)";
    const sizeKb = (a.byteSize / 1024).toFixed(1);
    const localPath = localPathFor(a);
    lines.push(`- **${name}** (\`${a.contentType}\`, ${sizeKb} KB)`);
    lines.push(`  - download: ${API_BASE}${a.contentPath}`);
    lines.push(`  - local path (preferred — read directly): \`${localPath}\``);
  }
  lines.push("");
  lines.push("> PI: read each attachment from its local path.");
  lines.push("> - For `.pdf` use the `pdf` skill. For `.md`/`.txt`/`.csv`/`.json`/`.tex` read directly.");
  lines.push("> - For `.pptx`/`.xlsx`/`.docx` use the matching skill. For images, describe them and call out figures.");
  lines.push("> - Cite each file by name when you reference it. If a file conflicts with the operator's question, ask which to trust.");
  lines.push("");

  // Machine-readable footer the UI uses to render attachment cards in past messages.
  // Hidden in HTML comment so the visible body stays clean.
  const machine = attachments.map((a) => ({
    name: a.originalFilename ?? "(untitled)",
    mime: a.contentType,
    bytes: a.byteSize,
    href: `${API_BASE}${a.contentPath}`,
  }));
  lines.push(`<!--attachments:${JSON.stringify(machine)}-->`);
  return lines.join("\n");
}

// ===========================================================================
// Crystallization → Promote-to-theme
// ===========================================================================

async function findAgentByRole(companyId: string, role: string): Promise<Agent | null> {
  const agents = await api<Agent[]>(`/api/companies/${companyId}/agents`);
  // Match by `name` (which equals the agent role in our company definitions).
  return agents.find((a) => a.name === role) ?? null;
}

async function resolveProposalProjectId(
  companyId: string,
  proposed: HypothesisProposal["proposedProject"],
): Promise<{ projectId: string; created: boolean; projectName: string }> {
  if (proposed.mode === "existing") {
    const projects = await api<Project[]>(`/api/companies/${companyId}/projects`);
    const found = projects.find((p) => p.id === proposed.projectId);
    if (!found) throw new Error(`existing project ${proposed.projectId} not found`);
    return { projectId: found.id, created: false, projectName: found.name };
  }
  // create-new: dedupe by name
  const projects = await api<Project[]>(`/api/companies/${companyId}/projects`);
  const existing = projects.find((p) => p.name === proposed.name);
  if (existing) return { projectId: existing.id, created: false, projectName: existing.name };
  const body: Record<string, unknown> = {
    name: proposed.name,
    description: "Created from a Research Chat hypothesis crystallization.",
    status: "in_progress",
  };
  if (proposed.color) body.color = proposed.color;
  if (proposed.targetDate) body.targetDate = proposed.targetDate;
  const created = await api<Project>(`/api/companies/${companyId}/projects`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { projectId: created.id, created: true, projectName: created.name };
}

type PromoteResult = {
  themeIssueId: string;
  themeIssueIdentifier: string;
  projectId: string;
  projectName: string;
  projectCreated: boolean;
  childIssues: Array<{
    id: string;
    identifier: string;
    role: string;
    title: string;
    assigneeAgentId: string | null;
    assigneeAgentName: string | null;
    blockedByCount: number;
  }>;
  unresolvedRoles: string[];
};

async function promoteTheme(input: {
  companyId: string;
  discussionIssueId: string;
  proposal: HypothesisProposal;
  approvedBy?: string;
}): Promise<PromoteResult> {
  const proposal = ensurePublishStep(validateProposal(input.proposal));
  const { projectId, projectName, created: projectCreated } =
    await resolveProposalProjectId(input.companyId, proposal.proposedProject);

  // Look up discussion issue identifier for back-reference in theme body.
  let discussionIdentifier: string | null = null;
  try {
    const disc = await api<{ identifier?: string }>(`/api/issues/${input.discussionIssueId}`);
    discussionIdentifier = disc.identifier ?? null;
  } catch {
    discussionIdentifier = null;
  }

  // 1) Create top-level theme issue.
  const themeBody = buildThemeIssueBody(proposal, discussionIdentifier);
  const piAgent = await findAgentByRole(input.companyId, "PI");
  const themeIssue = await api<Issue & { identifier?: string }>(
    `/api/companies/${input.companyId}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        title: proposal.title,
        description: themeBody,
        status: "in_progress",
        priority: "high",
        assigneeAgentId: piAgent?.id ?? null,
      }),
    },
  );

  // 2) Create child issues (without dependencies first; we'll patch blockedBy after).
  const created: Array<{
    id: string;
    identifier: string;
    role: string;
    title: string;
    assigneeAgentId: string | null;
    assigneeAgentName: string | null;
    dependsOn: string[];
  }> = [];
  const unresolvedRoles: string[] = [];

  for (const child of proposal.childIssues) {
    const agent = await findAgentByRole(input.companyId, child.role);
    if (!agent) unresolvedRoles.push(child.role);
    const issue = await api<Issue & { identifier?: string }>(
      `/api/companies/${input.companyId}/issues`,
      {
        method: "POST",
        body: JSON.stringify({
          projectId,
          parentId: themeIssue.id,
          title: child.title,
          description: buildChildIssueBody(child, proposal),
          status: "todo",
          priority: child.priority ?? "medium",
          assigneeAgentId: agent?.id ?? null,
        }),
      },
    );
    created.push({
      id: issue.id,
      identifier: issue.identifier ?? "",
      role: child.role,
      title: child.title,
      assigneeAgentId: agent?.id ?? null,
      assigneeAgentName: agent?.name ?? null,
      dependsOn: child.dependsOn ?? [],
    });
  }

  // 3) Wire up blockedBy relations using `dependsOn` (role-name based).
  const byRole = new Map<string, string>();
  for (const c of created) byRole.set(c.role, c.id);

  const childResults: PromoteResult["childIssues"] = [];
  for (const c of created) {
    const blockedByIds = (c.dependsOn ?? [])
      .map((r) => byRole.get(r))
      .filter((x): x is string => Boolean(x));
    if (blockedByIds.length > 0) {
      try {
        await api(`/api/issues/${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ blockedByIssueIds: blockedByIds }),
        });
      } catch {
        // non-fatal — at worst the dependency edge is missing.
      }
    }
    childResults.push({
      id: c.id,
      identifier: c.identifier,
      role: c.role,
      title: c.title,
      assigneeAgentId: c.assigneeAgentId,
      assigneeAgentName: c.assigneeAgentName,
      blockedByCount: blockedByIds.length,
    });
  }

  await ensureAgentsResumed([
    piAgent?.id ?? null,
    ...childResults.map((child) => child.assigneeAgentId),
  ]);

  if (piAgent?.id) {
    await normalizeDiscussionIssueForTurn({
      companyId: input.companyId,
      issueId: input.discussionIssueId,
      piAgentId: piAgent.id,
    }).catch(() => undefined);
  }

  // 4) Post a "✅ promoted to theme" comment back on the discussion issue.
  try {
    const themeRef = themeIssue.identifier
      ? `${themeIssue.identifier} — ${proposal.title}`
      : proposal.title;
    const childList = childResults
      .map(
        (c) =>
          `  - **${c.role}** → ${c.identifier ? `\`${c.identifier}\` ` : ""}${c.title}${c.assigneeAgentName ? "" : " *(unassigned — role had no matching agent)*"}`,
      )
      .join("\n");
    await api(`/api/issues/${input.discussionIssueId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: `✅ **Promoted to research theme**${input.approvedBy ? ` by ${input.approvedBy}` : ""}.

- Project: **${projectName}**${projectCreated ? " *(newly created)*" : ""}
- Theme issue: **${themeRef}**
- Child pipeline:
${childList}${unresolvedRoles.length > 0 ? `\n\n⚠️ Unresolved roles (no matching agent): ${unresolvedRoles.join(", ")}` : ""}

The discussion thread stays open here — use it for follow-up questions about the theme. Substantive new threads should branch from the theme issue.

${SYSTEM_NOTICE_MARKER}
${NO_WAKE_SYSTEM_NOTICE_MARKER}`,
      }),
    });
  } catch {
    // non-fatal
  }

  return {
    themeIssueId: themeIssue.id,
    themeIssueIdentifier: themeIssue.identifier ?? "",
    projectId,
    projectName,
    projectCreated,
    childIssues: childResults,
    unresolvedRoles,
  };
}

async function requestCrystallization(input: {
  companyId: string;
  issueId: string;
  piAgentId: string;
  hint?: string;
}): Promise<{ commentId: string; runId: string | null; piPaused: boolean }> {
  await normalizeDiscussionIssueForTurn({
    companyId: input.companyId,
    issueId: input.issueId,
    piAgentId: input.piAgentId,
  });

  const promptBody = [
    "🪄 **Operator requests hypothesis crystallization.**",
    "",
    "PI: review the discussion above and decide whether the hypothesis is ready.",
    "If yes — emit ONE comment with a brief rationale and a fenced",
    "`hypothesis-proposal` JSON block per the `research-discussion` skill spec.",
    "If not ready — explain in 1–3 short paragraphs which quality-bar items",
    "are still open and what one question would resolve the biggest one.",
    input.hint ? `\nOperator hint: ${input.hint}` : "",
    "",
    SYSTEM_NOTICE_MARKER,
  ]
    .filter(Boolean)
    .join("\n");

  const comment = await api<{ id: string }>(`/api/issues/${input.issueId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: promptBody }),
  });

  // Pre-check pause state to give the UI an honest answer about whether PI
  // will actually wake. The wakeup endpoint silently no-ops on paused agents.
  let piPaused = false;
  try {
    const agent = await api<Agent>(`/api/agents/${input.piAgentId}`);
    piPaused = agent.status === "paused";
  } catch {
    piPaused = false;
  }

  // No manual wake — posting the comment auto-wakes the assignee via
  // `issue_commented`. Manual wake on top causes Cursor session conflicts
  // (see sendMessage).
  return { commentId: comment.id, runId: null, piPaused };
}

async function resumePI(input: { piAgentId: string }): Promise<{ status: string }> {
  // Resume an explicitly-paused agent so subsequent wakeups take effect.
  const result = await api<{ status: string }>(`/api/agents/${input.piAgentId}/resume`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return { status: result.status ?? "idle" };
}

async function ensureAgentsResumed(agentIds: Array<string | null | undefined>) {
  const unique = [...new Set(agentIds.filter((value): value is string => typeof value === "string" && value.length > 0))];
  for (const agentId of unique) {
    try {
      const agent = await api<Agent>(`/api/agents/${agentId}`);
      if (agent.status === "paused") {
        await api(`/api/agents/${agentId}/resume`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
    } catch {
      // non-fatal: promotion still succeeds even if a specific resume probe fails
    }
  }
}

async function resetDiscussion(input: {
  companyId: string;
  oldIssueId: string;
  archiveOld?: boolean;
}): Promise<{ newIssueId: string; newIssueIdentifier: string; archivedOld: boolean }> {
  // Mark the old discussion issue as completed (so it won't be re-bootstrapped
  // by findOrCreateDiscussionIssue), then create a fresh one.
  let archivedOld = false;
  if (input.archiveOld !== false) {
    try {
      // Renaming closes the bootstrap idempotency loop (we look up by exact title).
      const ts = new Date().toISOString().slice(0, 10);
      await api(`/api/issues/${input.oldIssueId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: `${DISCUSSION_ISSUE_TITLE} — archived ${ts}`,
          status: "completed",
        }),
      });
      archivedOld = true;
    } catch {
      archivedOld = false;
    }
  }

  // Bootstrap creates a new discussion issue under the same project.
  const project = await findOrCreateDiscussionProject(input.companyId);
  const pi = await findPI(input.companyId);
  const newIssue = await api<Issue & { identifier?: string }>(
    `/api/companies/${input.companyId}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        title: DISCUSSION_ISSUE_TITLE,
        description: DISCUSSION_ISSUE_DESCRIPTION,
        status: DISCUSSION_RESTING_STATUS,
        priority: "high",
        assigneeAgentId: pi.id,
      }),
    },
  );
  return {
    newIssueId: newIssue.id,
    newIssueIdentifier: newIssue.identifier ?? "",
    archivedOld,
  };
}

async function sendMessage(input: {
  companyId: string;
  issueId: string;
  piAgentId: string;
  body: string;
  attachments?: AttachmentRef[];
}): Promise<{
  commentId: string;
  runId: string | null;
  attachmentCount: number;
  piPaused: boolean;
}> {
  const attachments = input.attachments ?? [];
  const trimmed = input.body.trim();
  if (!trimmed && attachments.length === 0) throw new Error("empty message");

  const userBody = trimmed || "(no message — attachments only)";
  const fullBody = userBody + buildAttachmentBlock(attachments);

  // Keep the canonical chat thread in its resting chat state before accepting
  // a new operator turn. This repairs stale `blocked`/recovery artifacts and
  // prevents Paperclip's stranded-work recovery from treating the thread like
  // a long-lived `in_progress` execution lane.
  await normalizeDiscussionIssueForTurn({
    companyId: input.companyId,
    issueId: input.issueId,
    piAgentId: input.piAgentId,
  });

  let piPaused = false;
  try {
    const agent = await api<Agent>(`/api/agents/${input.piAgentId}`);
    piPaused = agent.status === "paused";
  } catch {
    piPaused = false;
  }

  // NOTE: We deliberately do NOT POST /agents/:id/wakeup here. The Paperclip
  // server already auto-wakes the assignee when an operator posts a comment
  // on an assigned issue (see issues.ts: "issue_commented" wakeup). Posting a
  // second manual wake creates two simultaneous heartbeat
  // runs that race for the Cursor session lock, and the manual one tends to
  // fail with `cursor-retrieval` session-conflict errors.
  const comment = await api<{ id: string }>(`/api/issues/${input.issueId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: fullBody }),
  });

  return { commentId: comment.id, runId: null, attachmentCount: attachments.length, piPaused };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register("chat", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      if (!companyId) throw new Error("companyId required");
      const issueId = typeof params.issueId === "string" ? params.issueId : undefined;
      return getChat({ companyId, issueId });
    });
    ctx.data.register("cycle", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      if (!companyId) throw new Error("companyId required");
      const cycle = await getResearchCycleSummary(companyId);
      return {
        companyId,
        researchCycle: cycle,
        fetchedAt: new Date().toISOString(),
      };
    });
    ctx.data.register("bootstrap", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      if (!companyId) throw new Error("companyId required");
      return bootstrap(companyId);
    });
    ctx.actions.register("sendMessage", async (params) => {
      const companyId = String(params.companyId ?? "");
      const issueId = String(params.issueId ?? "");
      const piAgentId = String(params.piAgentId ?? "");
      const body = String(params.body ?? "");
      const attachmentsRaw = Array.isArray(params.attachments) ? params.attachments : [];
      const attachments: AttachmentRef[] = attachmentsRaw
        .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object")
        .map((a) => ({
          id: String(a.id ?? ""),
          originalFilename:
            a.originalFilename === null || typeof a.originalFilename !== "string"
              ? null
              : a.originalFilename,
          contentType: String(a.contentType ?? "application/octet-stream"),
          byteSize: typeof a.byteSize === "number" ? a.byteSize : 0,
          objectKey: String(a.objectKey ?? ""),
          contentPath: String(a.contentPath ?? ""),
        }))
        .filter((a) => a.id && a.objectKey);
      if (!companyId || !issueId || !piAgentId)
        throw new Error("companyId, issueId, piAgentId required");
      return sendMessage({
        companyId,
        issueId,
        piAgentId,
        body,
        attachments,
      });
    });
    ctx.actions.register("requestCrystallization", async (params) => {
      const companyId = String(params.companyId ?? "");
      const issueId = String(params.issueId ?? "");
      const piAgentId = String(params.piAgentId ?? "");
      const hint = typeof params.hint === "string" ? params.hint : undefined;
      if (!companyId || !issueId || !piAgentId)
        throw new Error("companyId, issueId, piAgentId required");
      return requestCrystallization({ companyId, issueId, piAgentId, hint });
    });
    ctx.actions.register("resumePI", async (params) => {
      const piAgentId = String(params.piAgentId ?? "");
      if (!piAgentId) throw new Error("piAgentId required");
      return resumePI({ piAgentId });
    });
    ctx.actions.register("resetDiscussion", async (params) => {
      const companyId = String(params.companyId ?? "");
      const oldIssueId = String(params.oldIssueId ?? "");
      const archiveOld = params.archiveOld !== false;
      if (!companyId || !oldIssueId) throw new Error("companyId and oldIssueId required");
      return resetDiscussion({ companyId, oldIssueId, archiveOld });
    });
    ctx.actions.register("promoteTheme", async (params) => {
      const companyId = String(params.companyId ?? "");
      const discussionIssueId = String(params.discussionIssueId ?? "");
      const proposal = params.proposal;
      const approvedBy = typeof params.approvedBy === "string" ? params.approvedBy : undefined;
      if (!companyId || !discussionIssueId)
        throw new Error("companyId and discussionIssueId required");
      if (!proposal) throw new Error("proposal required");
      return promoteTheme({
        companyId,
        discussionIssueId,
        proposal: proposal as HypothesisProposal,
        approvedBy,
      });
    });
    ctx.logger.info("Research Chat plugin ready", { apiBase: API_BASE });
  },

  async onHealth() {
    return { status: "ok", message: `Research Chat worker pointed at ${API_BASE}` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
