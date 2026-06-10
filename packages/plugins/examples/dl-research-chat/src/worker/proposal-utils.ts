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

const ALLOWED_ROLES = [
  "Ideator",
  "Lit Scout",
  "Experimenter",
  "Critic",
  "Writer",
  "Mentor",
  "Engineer",
  "Worker",
  "PI",
] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export function validateProposal(raw: unknown): HypothesisProposal {
  if (!raw || typeof raw !== "object") throw new Error("proposal must be an object");
  const p = raw as Record<string, unknown>;
  if (typeof p.title !== "string" || !p.title.trim()) throw new Error("proposal.title required");
  if (typeof p.hypothesis !== "string" || !p.hypothesis.trim()) {
    throw new Error("proposal.hypothesis required");
  }
  if (!Array.isArray(p.successCriteria) || p.successCriteria.length === 0) {
    throw new Error("proposal.successCriteria must be a non-empty array");
  }
  if (!p.proposedProject || typeof p.proposedProject !== "object") {
    throw new Error("proposal.proposedProject required");
  }
  if (!Array.isArray(p.childIssues) || p.childIssues.length === 0) {
    throw new Error("proposal.childIssues must be a non-empty array");
  }
  if (p.childIssues.length > 12) throw new Error("proposal.childIssues exceeds max 12 items");

  const childRoles = new Set<string>();
  for (const c of p.childIssues as Record<string, unknown>[]) {
    if (typeof c.role !== "string" || !ALLOWED_ROLES.includes(c.role as AllowedRole)) {
      throw new Error(`childIssues role must be one of ${ALLOWED_ROLES.join(", ")} (got '${c.role}')`);
    }
    if (typeof c.title !== "string" || !c.title.trim()) {
      throw new Error(`childIssues[${c.role}].title required`);
    }
    childRoles.add(c.role);
  }
  for (const c of p.childIssues as Record<string, unknown>[]) {
    if (Array.isArray(c.dependsOn)) {
      for (const dep of c.dependsOn) {
        if (typeof dep !== "string" || !childRoles.has(dep)) {
          throw new Error(`childIssues[${c.role}].dependsOn references unknown role '${dep}'`);
        }
      }
    }
  }
  return raw as HypothesisProposal;
}

const PROPOSAL_FENCE = /(?:```|~~~)hypothesis-proposal\s*\n([\s\S]*?)\n(?:```|~~~)/g;

export function extractProposalBlocks(body: string): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(PROPOSAL_FENCE.source, "g");
  while ((match = re.exec(body)) !== null) out.push(match[1]);
  return out;
}

export function extractProposalsFromBody(body: string): {
  proposals: HypothesisProposal[];
  malformedBlocks: string[];
} {
  const proposals: HypothesisProposal[] = [];
  const malformedBlocks: string[] = [];
  for (const raw of extractProposalBlocks(body)) {
    try {
      const parsed = JSON.parse(raw);
      proposals.push(validateProposal(parsed));
    } catch {
      malformedBlocks.push(raw);
    }
  }
  return { proposals, malformedBlocks };
}

export function buildThemeIssueBody(p: HypothesisProposal, discussionIssueIdentifier: string | null): string {
  const lines: string[] = [];
  lines.push(`# ${p.title}`);
  if (p.summary) {
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(p.summary);
  }
  lines.push("");
  lines.push("## Hypothesis");
  lines.push("");
  lines.push(`> ${p.hypothesis}`);
  lines.push("");
  lines.push("## Success criteria");
  lines.push("");
  for (const c of p.successCriteria) lines.push(`- [ ] ${c}`);
  if (p.scope) {
    lines.push("");
    lines.push("## Scope");
    lines.push("");
    if (p.scope.timeBudget) lines.push(`- **Time budget**: ${p.scope.timeBudget}`);
    if (p.scope.computeBudget) lines.push(`- **Compute budget**: ${p.scope.computeBudget}`);
    if (p.scope.constraints && p.scope.constraints.length > 0) {
      lines.push(`- **Constraints**:`);
      for (const k of p.scope.constraints) lines.push(`  - ${k}`);
    }
  }
  if (p.differentiatedFrom && p.differentiatedFrom.length > 0) {
    lines.push("");
    lines.push("## Differentiated from prior work");
    lines.push("");
    for (const d of p.differentiatedFrom) {
      const meta = [d.year, d.venue].filter(Boolean).join(", ");
      lines.push(`- **${d.title}**${meta ? ` (${meta})` : ""}${d.delta ? ` — ${d.delta}` : ""}`);
    }
  }
  lines.push("");
  lines.push("## Pipeline");
  lines.push("");
  lines.push("Child issues are linked below; each is parented to this theme.");
  if (discussionIssueIdentifier) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`Crystallized from discussion: \`${discussionIssueIdentifier}\``);
  }
  return lines.join("\n");
}

export function buildChildIssueBody(child: ChildIssueProposal, theme: HypothesisProposal): string {
  const lines: string[] = [];
  lines.push(`> Part of theme: **${theme.title}**`);
  lines.push("");
  if (child.deliverable) {
    lines.push("## Deliverable");
    lines.push("");
    lines.push(child.deliverable);
    lines.push("");
  }
  lines.push("## Theme hypothesis (context)");
  lines.push("");
  lines.push(`> ${theme.hypothesis}`);
  lines.push("");
  lines.push("## Success criteria for the theme");
  for (const c of theme.successCriteria) lines.push(`- ${c}`);
  if (child.dependsOn && child.dependsOn.length > 0) {
    lines.push("");
    lines.push("## Dependencies");
    lines.push("");
    for (const d of child.dependsOn) lines.push(`- depends on: ${d}`);
  }
  return lines.join("\n");
}

export function ensurePublishStep(proposal: HypothesisProposal): HypothesisProposal {
  const hasPublish = proposal.childIssues.some((c) => /^\s*\[publish\]/i.test(c.title));
  if (hasPublish) return proposal;
  const writerRoles = proposal.childIssues
    .filter((c) => c.role === "Writer")
    .map((c) => c.role as string);
  const dependsOn = writerRoles.length > 0 ? ["Writer"] : [];
  const augmented: HypothesisProposal = {
    ...proposal,
    childIssues: [
      ...proposal.childIssues,
      {
        role: "Writer",
        title: "[Publish] Typeset paper artifacts (HTML/PDF/LaTeX)",
        priority: "medium",
        deliverable: "paper/dist/main.{html,pdf,tex} produced via the paper-typeset skill",
        dependsOn,
      } as ChildIssueProposal,
    ],
  };
  return augmented;
}
