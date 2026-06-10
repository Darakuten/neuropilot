export type ChildIssueProposal = {
  role: string;
  title: string;
  priority?: "low" | "medium" | "high" | "urgent";
  deliverable?: string;
  dependsOn?: string[];
};

export type HypothesisProposal = {
  version: number;
  title: string;
  summary?: string;
  hypothesis: string;
  successCriteria: string[];
  scope?: { timeBudget?: string; computeBudget?: string; constraints?: string[] };
  differentiatedFrom?: Array<{ title: string; year?: string; venue?: string; delta?: string }>;
  proposedProject:
    | { mode: "create-new"; name: string; color?: string; targetDate?: string }
    | { mode: "existing"; projectId: string };
  childIssues: ChildIssueProposal[];
};

export type ChatMessage = {
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

export type ActiveRun = {
  id: string;
  status: string;
  startedAt: string | null;
  elapsedSec: number | null;
  triggerDetail: string;
  model: string | null;
};

export type ResearchCycleNode = {
  id: string;
  identifier: string;
  title: string;
  status: string;
  phase: number;
  progressPct: number;
  blockedBy: string[];
};

export type ResearchCyclePhase = {
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

export type ResearchCycleSummary = {
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

export type ChatPayload = {
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
  latestProposal: {
    messageId: string;
    createdAt: string;
    proposal: HypothesisProposal;
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

export type CyclePayload = {
  companyId: string;
  researchCycle: ResearchCycleSummary | null;
  fetchedAt: string;
};

export type PromoteResult = {
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

export type UploadedAttachment = {
  id: string;
  originalFilename: string | null;
  contentType: string;
  byteSize: number;
  objectKey: string;
  contentPath: string;
};
