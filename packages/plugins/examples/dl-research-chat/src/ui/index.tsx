import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  usePluginAction,
  usePluginData,
  useHostContext,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";
import type {
  ActiveRun,
  ChatMessage,
  ChatPayload,
  ChildIssueProposal,
  CyclePayload,
  HypothesisProposal,
  PromoteResult,
  ResearchCycleNode,
  ResearchCycleSummary,
  UploadedAttachment,
} from "./types.js";
import { fileIcon, formatBytes, formatRelative, statusColor } from "./utils.js";

const POLL_INTERVAL_MS = 4000;
const MAX_FILES_PER_MESSAGE = 8;
const COLORS = {
  bg: "var(--background, #0e1116)",
  panel: "var(--panel, rgba(255,255,255,0.04))",
  border: "var(--border, rgba(255,255,255,0.10))",
  text: "var(--text, #e6e6e6)",
  muted: "var(--muted, rgba(255,255,255,0.55))",
  user: "#3a86ff",
  pi: "#06d6a0",
  system: "rgba(255,255,255,0.35)",
  accent: "#ffbe0b",
  attach: "#bd93f9",
  danger: "#e63946",
};

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "calc(100vh - 64px)",
  background: COLORS.bg,
  color: COLORS.text,
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Inter', sans-serif",
  position: "relative",
};

function ResearchCycleTreeCard({
  cycle,
  companyPrefix,
}: {
  cycle: ResearchCycleSummary;
  companyPrefix: string | null;
}) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>Research cycle overview</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {cycle.themeIssueIdentifier || "Theme"} · {cycle.themeTitle}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: COLORS.muted }}>
            current phase {cycle.currentPhase}/{cycle.totalPhases}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.accent }}>
            {cycle.overallProgressPct}%
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted }}>
            strict done ({cycle.doneNodeCount}/{cycle.totalNodeCount}) · terminal {cycle.overallTerminalPct}%
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        {cycle.phaseProgress.map((phase) => (
          <div key={phase.phase} style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: phase.phase === cycle.currentPhase ? COLORS.accent : COLORS.muted }}>
              {phase.label}
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${phase.progressPct}%`,
                  height: "100%",
                  background: phase.phase === cycle.currentPhase ? COLORS.accent : COLORS.pi,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "right" }}>
              {phase.progressPct}% done ({phase.done}/{phase.total}) · {phase.cancelled} cancelled
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 4, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
        {cycle.nodes.map((node) => (
          <div
            key={node.id}
            style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr auto auto",
              gap: 8,
              alignItems: "center",
              fontSize: 12,
              padding: "4px 6px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span style={{ color: COLORS.muted, fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
              P{node.phase}
            </span>
            <a
              href={companyPrefix ? `/${companyPrefix}/issues/${node.identifier || node.id}` : `/issues/${node.id}`}
              style={{
                color: COLORS.text,
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={node.title}
            >
              {node.identifier ? `${node.identifier} · ` : ""}
              {node.title}
            </a>
            <span style={{ color: statusColor(node.status, COLORS), textTransform: "uppercase", fontSize: 10 }}>
              {node.status}
            </span>
            <span style={{ color: COLORS.muted, fontSize: 11 }}>{node.progressPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchCycleBlockDiagram({ cycle }: { cycle: ResearchCycleSummary }) {
  const columnGap = 280;
  const rowGap = 76;
  const nodeWidth = 220;
  const nodeHeight = 50;
  const paddingX = 30;
  const paddingY = 30;

  const byPhase = new Map<number, ResearchCycleNode[]>();
  for (const node of cycle.nodes) {
    const arr = byPhase.get(node.phase) ?? [];
    arr.push(node);
    byPhase.set(node.phase, arr);
  }
  for (const nodes of byPhase.values()) {
    nodes.sort((a, b) => a.title.localeCompare(b.title));
  }

  const nodePos = new Map<string, { x: number; y: number; node: ResearchCycleNode }>();
  for (let phase = 1; phase <= cycle.totalPhases; phase++) {
    const nodes = byPhase.get(phase) ?? [];
    nodes.forEach((node, row) => {
      const x = paddingX + (phase - 1) * columnGap;
      const y = paddingY + row * rowGap;
      nodePos.set(node.id, { x, y, node });
    });
  }

  const maxRows = Math.max(1, ...Array.from(byPhase.values()).map((nodes) => nodes.length));
  const width = paddingX * 2 + cycle.totalPhases * columnGap;
  const height = paddingY * 2 + maxRows * rowGap;

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      <svg width={width} height={height}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.45)" />
          </marker>
        </defs>

        {cycle.nodes.flatMap((node) =>
          node.blockedBy.map((depId, idx) => {
            const from = nodePos.get(depId);
            const to = nodePos.get(node.id);
            if (!from || !to) return null;
            const x1 = from.x + nodeWidth;
            const y1 = from.y + nodeHeight / 2;
            const x2 = to.x;
            const y2 = to.y + nodeHeight / 2;
            const cx = (x1 + x2) / 2;
            return (
              <path
                key={`${depId}-${node.id}-${idx}`}
                d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="1.2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            );
          }),
        )}

        {Array.from({ length: cycle.totalPhases }).map((_, i) => {
          const phase = i + 1;
          const x = paddingX + i * columnGap;
          return (
            <text
              key={`phase-${phase}`}
              x={x}
              y={18}
              fill={phase === cycle.currentPhase ? COLORS.accent : COLORS.muted}
              fontSize={11}
              fontWeight={600}
            >
              {`P${phase}`}
            </text>
          );
        })}

        {cycle.nodes.map((node) => {
          const pos = nodePos.get(node.id);
          if (!pos) return null;
          const accent = statusColor(node.status, COLORS);
          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={nodeWidth}
                height={nodeHeight}
                rx={8}
                fill="rgba(0,0,0,0.18)"
                stroke={accent}
                strokeWidth={1.1}
              />
              <text x={10} y={20} fill={COLORS.text} fontSize={11} fontWeight={600}>
                {(node.identifier ? `${node.identifier} ` : "") + node.title.slice(0, 24)}
              </text>
              <text x={10} y={38} fill={accent} fontSize={10}>
                {`${node.status.toUpperCase()} · ${node.progressPct}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SystemNotice({ msg }: { msg: ChatMessage }) {
  // Strip the marker from display.
  const body = msg.body.replace(/<!--research-chat-(?:system-notice|no-wake)-->/g, "").trim();
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "4px 16px" }}>
      <div
        style={{
          maxWidth: 640,
          padding: "6px 14px",
          fontSize: 11,
          color: COLORS.muted,
          background: "rgba(255,255,255,0.025)",
          border: `1px dashed ${COLORS.border}`,
          borderRadius: 999,
          textAlign: "center",
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          maxHeight: 60,
          overflow: "hidden",
        }}
        title={body}
      >
        {body.split("\n").slice(0, 2).join(" · ")}
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.authorKind === "user";
  const isPI = msg.authorKind === "pi";
  const isSystem = msg.authorKind === "system";
  if (isSystem) return <SystemNotice msg={msg} />;
  const align = isUser ? "flex-end" : "flex-start";
  const accent = isUser ? COLORS.user : isPI ? COLORS.pi : COLORS.system;

  // Render attachment cards inline if the body has an "<!-- attachments:json -->" block
  const attachmentMatch = /<!--attachments:(\[.+?\])-->/s.exec(msg.body);
  let attachments: Array<{ name: string; mime: string; bytes: number; href: string }> = [];
  let cleanBody = msg.body;
  if (attachmentMatch) {
    try {
      attachments = JSON.parse(attachmentMatch[1]);
      cleanBody = msg.body.replace(attachmentMatch[0], "").trim();
      // strip the human-readable attachment summary block too if present
      cleanBody = cleanBody.replace(/\n*📎 \*\*Attached files\*\*:[\s\S]*$/m, "").trim();
    } catch {
      // ignore parse failure
    }
  }
  // Strip fenced hypothesis-proposal blocks from the visible bubble — the
  // dedicated Proposal Card below renders the structured form. Leave the
  // PI's rationale (everything before the fence) intact.
  const hasProposalFence = /(?:```|~~~)hypothesis-proposal\s*\n[\s\S]*?\n(?:```|~~~)/g.test(cleanBody);
  if (hasProposalFence) {
    cleanBody = cleanBody
      .replace(/(?:```|~~~)hypothesis-proposal\s*\n[\s\S]*?\n(?:```|~~~)/g, "")
      .trim();
  }

  return (
    <div style={{ display: "flex", justifyContent: align, padding: "6px 16px" }}>
      <div
        style={{
          maxWidth: "min(640px, 78%)",
          background: isUser ? `${COLORS.user}22` : isPI ? `${COLORS.pi}18` : "transparent",
          border: `1px solid ${accent}55`,
          borderLeft: isPI ? `3px solid ${accent}` : isUser ? undefined : `1px solid ${accent}55`,
          borderRight: isUser ? `3px solid ${accent}` : undefined,
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            fontSize: 11,
            color: COLORS.muted,
            marginBottom: 6,
          }}
        >
          <span style={{ color: accent, fontWeight: 600 }}>{msg.authorLabel}</span>
          <span title={msg.createdAt}>{formatRelative(msg.createdAt)}</span>
        </div>
        {cleanBody ? (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{cleanBody}</div>
        ) : null}
        {attachments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: cleanBody ? 8 : 0 }}>
            {attachments.map((a, i) => (
              <a
                key={i}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.attach}55`,
                  background: `${COLORS.attach}12`,
                  color: COLORS.text,
                  textDecoration: "none",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    color: COLORS.attach,
                    background: `${COLORS.attach}22`,
                    padding: "2px 6px",
                    borderRadius: 3,
                    letterSpacing: 0.5,
                  }}
                >
                  {fileIcon(a.name, a.mime)}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.name || "untitled"}
                </span>
                <span style={{ color: COLORS.muted }}>{formatBytes(a.bytes)}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProposalWarningCard({
  createdAt,
  onRetry,
}: {
  createdAt: string;
  onRetry: () => void;
}) {
  return (
    <div style={{ padding: "8px 16px", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "min(760px, 100%)",
          borderRadius: 12,
          border: `1px solid ${COLORS.danger}55`,
          background: `${COLORS.danger}12`,
          boxShadow: `0 0 0 1px ${COLORS.danger}22 inset`,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ color: COLORS.danger, fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}>
              MALFORMED PROPOSAL
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: COLORS.text }}>
              PI generated a `hypothesis-proposal` block, but it was not valid JSON so the structured
              proposal card could not be rendered.
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: COLORS.muted }}>
              {formatRelative(createdAt)}. Ask PI to crystallize again after the posting fix, then review
              the new card here.
            </div>
          </div>
          <button
            onClick={onRetry}
            style={{
              background: `${COLORS.danger}22`,
              color: COLORS.danger,
              border: `1px solid ${COLORS.danger}66`,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Retry crystallize
          </button>
        </div>
      </div>
    </div>
  );
}

type ProposalCardProps = {
  proposal: HypothesisProposal;
  promoted: boolean;
  promoting: boolean;
  promoteResult: PromoteResult | null;
  companyPrefix: string | null;
  onApprove: (edited: HypothesisProposal) => void;
  onRefine: () => void;
};

function PriorityPill({ p }: { p?: ChildIssueProposal["priority"] }) {
  const map: Record<string, { bg: string; fg: string }> = {
    urgent: { bg: "#e6394633", fg: "#ff8a92" },
    high: { bg: "#ffbe0b33", fg: "#ffd76b" },
    medium: { bg: "#3a86ff33", fg: "#88b0ff" },
    low: { bg: "#06d6a033", fg: "#7ce6c8" },
  };
  const k = p ?? "medium";
  const c = map[k];
  return (
    <span
      style={{
        padding: "1px 7px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {k}
    </span>
  );
}

function ProposalCard({
  proposal,
  promoted,
  promoting,
  promoteResult,
  companyPrefix,
  onApprove,
  onRefine,
}: ProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HypothesisProposal>(proposal);
  // Reset draft when underlying proposal changes (PI emitted a new version).
  useEffect(() => setDraft(proposal), [proposal]);

  const projectName =
    proposal.proposedProject.mode === "create-new"
      ? proposal.proposedProject.name
      : `(existing project ${proposal.proposedProject.projectId.slice(0, 8)}…)`;

  const palette = promoted
    ? { accent: COLORS.muted, glow: "transparent", label: "PROMOTED" }
    : { accent: COLORS.accent, glow: `${COLORS.accent}55`, label: "HYPOTHESIS PROPOSAL" };

  return (
    <div style={{ padding: "8px 16px", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: `linear-gradient(180deg, ${palette.accent}10 0%, ${palette.accent}03 100%)`,
          border: `1px solid ${palette.accent}66`,
          borderRadius: 12,
          padding: 16,
          boxShadow: `0 0 24px -8px ${palette.glow}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: palette.accent,
              padding: "3px 9px",
              borderRadius: 4,
              border: `1px solid ${palette.accent}55`,
              background: `${palette.accent}11`,
            }}
          >
            {palette.label}
          </span>
          {!editing && !promoted ? (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: "transparent",
                color: COLORS.muted,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Edit
            </button>
          ) : null}
        </div>

        {editing ? (
          <ProposalEditor
            draft={draft}
            onChange={setDraft}
            onCancel={() => {
              setDraft(proposal);
              setEditing(false);
            }}
            onSave={() => setEditing(false)}
          />
        ) : (
          <>
            <input
              type="text"
              readOnly
              value={proposal.title}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: COLORS.text,
                fontSize: 16,
                fontWeight: 600,
                padding: 0,
                marginBottom: 10,
              }}
            />
            {proposal.summary ? (
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12, lineHeight: 1.55 }}>
                {proposal.summary}
              </div>
            ) : null}

            <Section label="Hypothesis">
              <div style={{ fontSize: 13, fontStyle: "italic" }}>{proposal.hypothesis}</div>
            </Section>

            <Section label="Success criteria">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                {proposal.successCriteria.map((c, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {c}
                  </li>
                ))}
              </ul>
            </Section>

            {proposal.scope ? (
              <Section label="Scope">
                <div style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  {proposal.scope.timeBudget ? (
                    <div>
                      <span style={{ color: COLORS.muted }}>time:</span> {proposal.scope.timeBudget}
                    </div>
                  ) : null}
                  {proposal.scope.computeBudget ? (
                    <div>
                      <span style={{ color: COLORS.muted }}>compute:</span> {proposal.scope.computeBudget}
                    </div>
                  ) : null}
                  {proposal.scope.constraints && proposal.scope.constraints.length > 0 ? (
                    <div>
                      <span style={{ color: COLORS.muted }}>constraints:</span>{" "}
                      {proposal.scope.constraints.join("; ")}
                    </div>
                  ) : null}
                </div>
              </Section>
            ) : null}

            {proposal.differentiatedFrom && proposal.differentiatedFrom.length > 0 ? (
              <Section label="Differentiated from">
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
                  {proposal.differentiatedFrom.map((d, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>{d.title}</strong>
                      {d.year ? ` (${d.year})` : ""}
                      {d.delta ? ` — ${d.delta}` : ""}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section label={`Project & ${proposal.childIssues.length}-step pipeline`}>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.muted,
                  marginBottom: 8,
                }}
              >
                project: <strong style={{ color: COLORS.text }}>{projectName}</strong>
                {proposal.proposedProject.mode === "create-new" ? (
                  <span style={{ color: COLORS.pi, marginLeft: 8 }}>(new)</span>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {proposal.childIssues.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      background: "rgba(255,255,255,0.02)",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        color: COLORS.pi,
                        background: `${COLORS.pi}22`,
                        padding: "2px 7px",
                        borderRadius: 3,
                        letterSpacing: 0.4,
                      }}
                    >
                      {c.role}
                    </span>
                    <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.title}
                      </div>
                      {c.dependsOn && c.dependsOn.length > 0 ? (
                        <div style={{ fontSize: 10, color: COLORS.muted }}>
                          depends on: {c.dependsOn.join(", ")}
                        </div>
                      ) : null}
                    </div>
                    <PriorityPill p={c.priority} />
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {promoted && promoteResult ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: `${COLORS.pi}10`,
              border: `1px solid ${COLORS.pi}55`,
              borderRadius: 8,
              fontSize: 12.5,
            }}
          >
            <div style={{ marginBottom: 6, color: COLORS.pi, fontWeight: 600 }}>
              ✅ Research theme created
            </div>
            <div style={{ color: COLORS.muted, marginBottom: 4 }}>
              Project: <strong style={{ color: COLORS.text }}>{promoteResult.projectName}</strong>
              {promoteResult.projectCreated ? " (newly created)" : ""}
            </div>
            <div style={{ color: COLORS.muted }}>
              Theme issue:{" "}
              <a
                href={
                  companyPrefix
                    ? `/${companyPrefix}/issues/${promoteResult.themeIssueIdentifier || promoteResult.themeIssueId}`
                    : `/issues/${promoteResult.themeIssueId}`
                }
                style={{ color: COLORS.user }}
              >
                <strong>{promoteResult.themeIssueIdentifier || promoteResult.themeIssueId.slice(0, 8)}</strong>
              </a>
            </div>
            <div style={{ color: COLORS.muted, marginTop: 4 }}>
              Child issues: {promoteResult.childIssues.length}
              {promoteResult.unresolvedRoles.length > 0 ? (
                <span style={{ color: COLORS.danger, marginLeft: 8 }}>
                  ⚠ unresolved roles: {promoteResult.unresolvedRoles.join(", ")}
                </span>
              ) : null}
            </div>
          </div>
        ) : promoted ? (
          <div
            style={{
              marginTop: 14,
              padding: 10,
              fontSize: 12,
              color: COLORS.muted,
              fontStyle: "italic",
            }}
          >
            This proposal was already promoted to a research theme. Continue refining the
            hypothesis here, or jump to the theme issue and work from there.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
            <button
              onClick={onRefine}
              disabled={promoting}
              style={{
                background: "transparent",
                color: COLORS.muted,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: "8px 14px",
                cursor: promoting ? "not-allowed" : "pointer",
                fontSize: 12,
              }}
            >
              Refine more
            </button>
            <button
              onClick={() => onApprove(draft)}
              disabled={promoting}
              style={{
                background: promoting ? `${COLORS.pi}66` : COLORS.pi,
                color: "#001a13",
                border: "none",
                borderRadius: 6,
                padding: "8px 18px",
                cursor: promoting ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {promoting ? "Launching…" : "Approve & launch"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          color: COLORS.muted,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ProposalEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: HypothesisProposal;
  onChange: (next: HypothesisProposal) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <LabeledInput
        label="Title"
        value={draft.title}
        onChange={(v) => onChange({ ...draft, title: v })}
      />
      <LabeledTextarea
        label="Hypothesis"
        value={draft.hypothesis}
        rows={2}
        onChange={(v) => onChange({ ...draft, hypothesis: v })}
      />
      <LabeledTextarea
        label="Summary"
        value={draft.summary ?? ""}
        rows={3}
        onChange={(v) => onChange({ ...draft, summary: v })}
      />
      <LabeledTextarea
        label="Success criteria (one per line)"
        value={draft.successCriteria.join("\n")}
        rows={Math.max(3, draft.successCriteria.length)}
        onChange={(v) =>
          onChange({
            ...draft,
            successCriteria: v.split("\n").map((s) => s.trim()).filter(Boolean),
          })
        }
      />
      {draft.proposedProject.mode === "create-new" ? (
        <LabeledInput
          label="Project name"
          value={draft.proposedProject.name}
          onChange={(v) =>
            onChange({
              ...draft,
              proposedProject: { ...draft.proposedProject, mode: "create-new", name: v },
            })
          }
        />
      ) : null}
      <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>
        Note: child issues are not editable here. To change them, ask PI to refine the proposal.
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            color: COLORS.muted,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          style={{
            background: COLORS.user,
            color: "white",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Done editing
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, color: COLORS.muted }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: "rgba(0,0,0,0.25)",
          color: COLORS.text,
          fontSize: 13,
          outline: "none",
        }}
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, color: COLORS.muted }}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: "rgba(0,0,0,0.25)",
          color: COLORS.text,
          fontSize: 13,
          fontFamily: "inherit",
          lineHeight: 1.4,
          resize: "vertical",
          outline: "none",
        }}
      />
    </label>
  );
}

function ThinkingIndicator({ run }: { run: ActiveRun }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = run.startedAt
    ? Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000)
    : run.elapsedSec ?? 0;
  return (
    <div style={{ padding: "6px 16px", display: "flex", justifyContent: "flex-start" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: `${COLORS.pi}18`,
          border: `1px solid ${COLORS.pi}55`,
          borderLeft: `3px solid ${COLORS.pi}`,
          borderRadius: 10,
          padding: "8px 14px",
          fontSize: 13,
          color: COLORS.muted,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: COLORS.pi,
            opacity: 0.4 + 0.6 * Math.abs(Math.sin(tick * 0.9)),
            boxShadow: `0 0 12px ${COLORS.pi}`,
          }}
        />
        <span style={{ color: COLORS.text }}>PI is thinking</span>
        <span>· {elapsed}s</span>
        {run.model ? (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: `${COLORS.accent}22`,
              color: COLORS.accent,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.4,
            }}
            title="model used by PI"
          >
            {run.model}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type AttachmentDraft =
  | { kind: "uploading"; localId: string; name: string; bytes: number; mime: string; progress: number }
  | { kind: "done"; localId: string; name: string; bytes: number; mime: string; uploaded: UploadedAttachment }
  | { kind: "error"; localId: string; name: string; bytes: number; mime: string; error: string };

function AttachmentChip({ draft, onRemove }: { draft: AttachmentDraft; onRemove: () => void }) {
  const isUploading = draft.kind === "uploading";
  const isError = draft.kind === "error";
  const accent = isError ? COLORS.danger : isUploading ? COLORS.muted : COLORS.attach;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px 4px 6px",
        borderRadius: 999,
        border: `1px solid ${accent}55`,
        background: `${accent}15`,
        fontSize: 11,
        color: COLORS.text,
        maxWidth: 240,
      }}
      title={isError ? draft.error : `${draft.name} (${formatBytes(draft.bytes)})`}
    >
      <span
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 9,
          fontWeight: 700,
          color: accent,
          background: `${accent}22`,
          padding: "2px 6px",
          borderRadius: 3,
          letterSpacing: 0.5,
        }}
      >
        {fileIcon(draft.name, draft.mime)}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {draft.name}
      </span>
      {isUploading ? (
        <span style={{ color: COLORS.muted }}>↑</span>
      ) : isError ? (
        <span style={{ color: COLORS.danger, fontWeight: 600 }}>!</span>
      ) : (
        <span style={{ color: COLORS.muted }}>{formatBytes(draft.bytes)}</span>
      )}
      <button
        onClick={onRemove}
        style={{
          background: "transparent",
          border: "none",
          color: COLORS.muted,
          cursor: "pointer",
          padding: 0,
          fontSize: 14,
          lineHeight: 1,
          marginLeft: 2,
        }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function ResearchCyclePhaseGraph({ cycle }: { cycle: ResearchCycleSummary }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>
        Phase graph (status mix per phase)
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {cycle.phaseProgress.map((phase) => {
          const total = Math.max(phase.total, 1);
          const doneW = (phase.done / total) * 100;
          const cancelledW = (phase.cancelled / total) * 100;
          const inFlightW = (phase.inFlight / total) * 100;
          const blockedW = (phase.blocked / total) * 100;
          const todoW = (phase.todo / total) * 100;
          return (
            <div
              key={phase.phase}
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 200px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 11, color: phase.phase === cycle.currentPhase ? COLORS.accent : COLORS.muted }}>
                {phase.label}
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <span title="done" style={{ width: `${doneW}%`, background: COLORS.pi }} />
                <span title="cancelled" style={{ width: `${cancelledW}%`, background: COLORS.muted }} />
                <span title="in progress/review" style={{ width: `${inFlightW}%`, background: COLORS.accent }} />
                <span title="blocked" style={{ width: `${blockedW}%`, background: COLORS.danger }} />
                <span title="todo/backlog" style={{ width: `${todoW}%`, background: "rgba(255,255,255,0.28)" }} />
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted, textAlign: "right" }}>
                {phase.done} done / {phase.cancelled} cancelled / {phase.inFlight} in flight / {phase.blocked} blocked / {phase.todo} todo
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
        <span style={{ color: COLORS.pi }}>■ done</span>
        <span style={{ color: COLORS.muted }}>■ cancelled</span>
        <span style={{ color: COLORS.accent }}>■ in progress/review</span>
        <span style={{ color: COLORS.danger }}>■ blocked</span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>■ todo/backlog</span>
      </div>
    </div>
  );
}

export function ResearchChatPage(_props: PluginPageProps) {
  const ctx = useHostContext();
  const companyId = ctx.companyId;
  const { data, loading, error, refresh } = usePluginData<ChatPayload>("chat", {
    companyId: companyId ?? "",
  });
  const send = usePluginAction("sendMessage");
  const requestCrystallization = usePluginAction("requestCrystallization");
  const promoteTheme = usePluginAction("promoteTheme");
  const resumePI = usePluginAction("resumePI");
  const resetDiscussion = usePluginAction("resetDiscussion");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [crystallizing, setCrystallizing] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<PromoteResult | null>(null);
  const [resuming, setResuming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Polling
  useEffect(() => {
    if (!companyId) return;
    const t = setInterval(() => refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [companyId, refresh]);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [data?.messages.length, data?.activeRun?.id]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!data) return;
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setDrafts((prev) =>
        prev.length >= MAX_FILES_PER_MESSAGE
          ? prev
          : [
              ...prev,
              { kind: "uploading", localId, name: file.name, bytes: file.size, mime: file.type, progress: 0 },
            ],
      );

      try {
        const form = new FormData();
        form.append("file", file);
        const resp = await fetch(
          `/api/companies/${data.companyId}/issues/${data.issueId}/attachments`,
          {
            method: "POST",
            body: form,
            credentials: "include",
          },
        );
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
        }
        const uploaded = (await resp.json()) as UploadedAttachment;
        setDrafts((prev) =>
          prev.map((d) =>
            d.localId === localId
              ? { kind: "done", localId, name: file.name, bytes: file.size, mime: file.type, uploaded }
              : d,
          ),
        );
      } catch (err) {
        setDrafts((prev) =>
          prev.map((d) =>
            d.localId === localId
              ? {
                  kind: "error",
                  localId,
                  name: file.name,
                  bytes: file.size,
                  mime: file.type,
                  error: (err as Error).message,
                }
              : d,
          ),
        );
      }
    },
    [data],
  );

  const onFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      const room = MAX_FILES_PER_MESSAGE - drafts.length;
      if (room <= 0) return;
      list.slice(0, room).forEach((f) => uploadFile(f));
    },
    [drafts, uploadFile],
  );

  const handleSend = useCallback(async () => {
    if (!data) return;
    const uploadedAttachments = drafts.filter(
      (d): d is Extract<AttachmentDraft, { kind: "done" }> => d.kind === "done",
    );
    if (!input.trim() && uploadedAttachments.length === 0) return;
    if (drafts.some((d) => d.kind === "uploading")) return;

    setSending(true);
    try {
      await send({
        companyId: data.companyId,
        issueId: data.issueId,
        piAgentId: data.piAgentId,
        body: input,
        attachments: uploadedAttachments.map((d) => d.uploaded),
      });
      setInput("");
      setDrafts([]);
      refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Failed to send: ${(err as Error).message}`);
    } finally {
      setSending(false);
    }
  }, [data, input, drafts, send, refresh]);

  const handleResume = useCallback(async () => {
    if (!data) return;
    setResuming(true);
    try {
      await resumePI({ piAgentId: data.piAgentId });
      refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Resume failed: ${(err as Error).message}`);
    } finally {
      setResuming(false);
    }
  }, [data, resumePI, refresh]);

  const handleReset = useCallback(async () => {
    if (!data) return;
    if (
      !confirm(
        "Archive the current discussion thread and start a fresh one?\n\nThe old thread is kept (renamed and marked completed) so you can still reference it from the issue board.",
      )
    )
      return;
    setResetting(true);
    setPromoteResult(null);
    try {
      await resetDiscussion({ companyId: data.companyId, oldIssueId: data.issueId });
      refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Reset failed: ${(err as Error).message}`);
    } finally {
      setResetting(false);
    }
  }, [data, resetDiscussion, refresh]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleCrystallize = useCallback(async () => {
    if (!data) return;
    if (!confirm("Ask PI to crystallize the current discussion into a hypothesis proposal?"))
      return;
    setCrystallizing(true);
    try {
      await requestCrystallization({
        companyId: data.companyId,
        issueId: data.issueId,
        piAgentId: data.piAgentId,
      });
      refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Crystallize failed: ${(err as Error).message}`);
    } finally {
      setCrystallizing(false);
    }
  }, [data, requestCrystallization, refresh]);

  const handleApprove = useCallback(
    async (proposal: HypothesisProposal) => {
      if (!data) return;
      if (
        !confirm(
          `This will create the project, theme issue, and ${proposal.childIssues.length} child issues, and assign them to the matching agents.\n\nApprove and launch the research pipeline?`,
        )
      )
        return;
      setPromoting(true);
      setPromoteResult(null);
      try {
        const result = (await promoteTheme({
          companyId: data.companyId,
          discussionIssueId: data.issueId,
          proposal,
        })) as PromoteResult;
        setPromoteResult(result);
        refresh();
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert(`Promote failed: ${(err as Error).message}`);
      } finally {
        setPromoting(false);
      }
    },
    [data, promoteTheme, refresh],
  );

  const handleRefine = useCallback(() => {
    // Just focus the textarea — operator types feedback as a normal chat message.
    const ta = document.querySelector("textarea[data-research-chat-input]") as HTMLTextAreaElement | null;
    if (ta) ta.focus();
  }, []);

  const headerStatusColor = useMemo(() => {
    if (!data) return COLORS.muted;
    switch (data.piAgentStatus) {
      case "idle":
        return COLORS.pi;
      case "running":
        return COLORS.accent;
      case "paused":
        return COLORS.muted;
      case "error":
        return COLORS.danger;
      default:
        return COLORS.muted;
    }
  }, [data]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  if (!companyId) {
    return (
      <div style={{ padding: 24, color: COLORS.muted }}>
        Open this page from a company-scoped route.
      </div>
    );
  }

  const hasUploadingDrafts = drafts.some((d) => d.kind === "uploading");
  const hasErrorDrafts = drafts.some((d) => d.kind === "error");
  const sendDisabled =
    !data ||
    sending ||
    hasUploadingDrafts ||
    (!input.trim() && drafts.filter((d) => d.kind === "done").length === 0);

  return (
    <div style={containerStyle} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <header
        style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: COLORS.panel,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Research Chat</div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
            {data ? (
              <>
                <span title={data.issueTitle}>{data.issueIdentifier || "—"}</span>
                <span style={{ margin: "0 8px" }}>·</span>
                <span>
                  PI:{" "}
                  <span style={{ color: headerStatusColor, fontWeight: 600 }}>
                    {data.piAgentStatus}
                  </span>
                </span>
                {data.piModel ? (
                  <>
                    <span style={{ margin: "0 8px" }}>·</span>
                    <span style={{ color: COLORS.muted }}>{data.piModel}</span>
                  </>
                ) : null}
              </>
            ) : loading ? (
              "Bootstrapping discussion thread…"
            ) : error ? (
              <span style={{ color: COLORS.danger }}>error: {error.message}</span>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={handleCrystallize}
            disabled={!data || crystallizing || (data?.messages.length ?? 0) < 2}
            title={
              !data
                ? ""
                : data.messages.length < 2
                  ? "Have a few turns of discussion before crystallizing"
                  : "Ask PI to produce a structured hypothesis proposal"
            }
            style={{
              background: crystallizing ? `${COLORS.accent}33` : `${COLORS.accent}22`,
              color: COLORS.accent,
              border: `1px solid ${COLORS.accent}88`,
              borderRadius: 6,
              padding: "6px 14px",
              cursor:
                !data || crystallizing || (data?.messages.length ?? 0) < 2 ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {crystallizing ? "Asking PI…" : "Crystallize hypothesis"}
          </button>
          <button
            onClick={handleReset}
            disabled={!data || resetting}
            title="Archive the current thread and start a fresh discussion"
            style={{
              background: "transparent",
              color: COLORS.muted,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: !data || resetting ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            {resetting ? "Resetting…" : "New thread"}
          </button>
          <button
            onClick={() => refresh()}
            style={{
              background: "transparent",
              color: COLORS.muted,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {(() => {
        if (!data) return null;
        if (data.piAgentStatus !== "paused") return null;
        // Only surface the warning if PI looks "stuck": the most recent
        // message is from the operator, and PI hasn't replied to it. A
        // paused state right after PI's own reply is not actionable for the
        // operator, so keep the banner quiet unless the pending turn is the
        // user's.
        const last = data.messages[data.messages.length - 1];
        if (!last) return null;
        if (last.authorKind !== "user") return null;
        return true;
      })() ? (
        <div
          style={{
            padding: "10px 16px",
            background: `${COLORS.danger}15`,
            borderBottom: `1px solid ${COLORS.danger}55`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            fontSize: 12.5,
            color: COLORS.text,
            flexShrink: 0,
          }}
        >
          <span>
            <strong style={{ color: COLORS.danger }}>PI is paused.</strong>{" "}
            <span style={{ color: COLORS.muted }}>
              Messages you send will be saved as comments but PI will not reply until you resume it.
            </span>
          </span>
          <button
            onClick={handleResume}
            disabled={resuming}
            style={{
              background: COLORS.danger,
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "6px 14px",
              cursor: resuming ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {resuming ? "Resuming…" : "Resume PI"}
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} style={{ overflowY: "auto", padding: "12px 0", flex: 1, minHeight: 0 }}>
        {data?.messages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: COLORS.muted,
              fontSize: 14,
            }}
          >
            <div style={{ marginBottom: 8 }}>No messages yet.</div>
            <div style={{ fontSize: 12 }}>
              Drop a research seed below — a sentence is enough. PI will read the vault, do a brief
              prior-art scan, then ask one focused question to start the loop.
            </div>
            <div style={{ fontSize: 12, marginTop: 8, color: COLORS.attach }}>
              Drag-and-drop PDFs or paste a paper URL — PI will read them as context.
            </div>
          </div>
        ) : (
          data?.messages.map((m) => {
            const isLatestProposal =
              data.latestProposal?.messageId === m.id && (m.proposals?.length ?? 0) > 0;
            const isLatestMalformedProposal = data.latestMalformedProposal?.messageId === m.id;
            return (
              <div key={m.id}>
                <Bubble msg={m} />
                {isLatestMalformedProposal && data.latestMalformedProposal ? (
                  <ProposalWarningCard
                    createdAt={data.latestMalformedProposal.createdAt}
                    onRetry={handleCrystallize}
                  />
                ) : null}
                {isLatestProposal && data.latestProposal ? (
                  <ProposalCard
                    proposal={data.latestProposal.proposal}
                    promoted={data.latestProposal.promoted}
                    promoting={promoting}
                    promoteResult={promoteResult}
                    companyPrefix={ctx.companyPrefix ?? null}
                    onApprove={handleApprove}
                    onRefine={handleRefine}
                  />
                ) : null}
              </div>
            );
          })
        )}
        {data?.activeRun ? <ThinkingIndicator run={data.activeRun} /> : null}
      </div>

      <footer
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          padding: 12,
          background: COLORS.panel,
          flexShrink: 0,
        }}
      >
        {drafts.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {drafts.map((d) => (
              <AttachmentChip
                key={d.localId}
                draft={d}
                onRemove={() => setDrafts((prev) => prev.filter((x) => x.localId !== d.localId))}
              />
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 8,
            alignItems: "end",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              onFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={drafts.length >= MAX_FILES_PER_MESSAGE}
            title={
              drafts.length >= MAX_FILES_PER_MESSAGE
                ? `Max ${MAX_FILES_PER_MESSAGE} files`
                : "Attach files"
            }
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: "var(--input-bg, rgba(0,0,0,0.25))",
              color: COLORS.text,
              cursor: drafts.length >= MAX_FILES_PER_MESSAGE ? "not-allowed" : "pointer",
              fontSize: 16,
              minHeight: 60,
              alignSelf: "stretch",
            }}
          >
            📎
          </button>
          <textarea
            data-research-chat-input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              data?.activeRun
                ? "PI is replying… you can still queue your next message."
                : drafts.length > 0
                  ? "Add a note about these files (optional)… ⌘+Enter to send"
                  : "Send a research seed (or drop PDFs / paste URLs). ⌘+Enter to send."
            }
            rows={3}
            style={{
              resize: "vertical",
              minHeight: 60,
              maxHeight: 260,
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: "var(--input-bg, rgba(0,0,0,0.25))",
              color: COLORS.text,
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.5,
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={sendDisabled}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: sendDisabled ? `${COLORS.user}55` : COLORS.user,
              color: "white",
              fontWeight: 600,
              cursor: sendDisabled ? "not-allowed" : "pointer",
              fontSize: 14,
              minWidth: 80,
              alignSelf: "stretch",
            }}
          >
            {sending ? "Sending…" : hasUploadingDrafts ? "Uploading…" : "Send"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>
          ⌘+Enter to send · drag-drop PDFs / images / .md /.csv · {drafts.filter((d) => d.kind === "done").length}/
          {MAX_FILES_PER_MESSAGE} attached
          {hasErrorDrafts ? <span style={{ color: COLORS.danger }}> · upload error — remove and retry</span> : null}
        </div>
      </footer>

      {/* Drag-over overlay */}
      {dragOver ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `${COLORS.attach}22`,
            border: `3px dashed ${COLORS.attach}`,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              padding: "20px 30px",
              background: COLORS.bg,
              border: `1px solid ${COLORS.attach}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.attach,
            }}
          >
            Drop files to attach
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ResearchCyclePage(_props: PluginPageProps) {
  const ctx = useHostContext();
  const companyId = ctx.companyId;
  const { data, loading, error, refresh } = usePluginData<CyclePayload>("cycle", {
    companyId: companyId ?? "",
  });

  useEffect(() => {
    if (!companyId) return;
    const t = setInterval(() => refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [companyId, refresh]);

  if (!companyId) {
    return <div style={{ padding: 24, color: COLORS.muted }}>Open this page from a company-scoped route.</div>;
  }

  return (
    <div style={containerStyle}>
      <header
        style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: COLORS.panel,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Research Cycle Visualizer</div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
            overall phase progress + transition block diagram
          </div>
        </div>
        <button
          onClick={() => refresh()}
          style={{
            background: "transparent",
            color: COLORS.muted,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Refresh
        </button>
      </header>

      <div style={{ padding: 14, overflow: "auto", display: "grid", gap: 12 }}>
        {loading && !data ? <div style={{ color: COLORS.muted }}>Loading research cycle…</div> : null}
        {error ? <div style={{ color: COLORS.danger }}>error: {error.message}</div> : null}
        {!loading && data?.researchCycle == null ? (
          <div style={{ color: COLORS.muted }}>No active theme cycle found yet.</div>
        ) : null}
        {data?.researchCycle ? (
          <>
            <ResearchCycleTreeCard cycle={data.researchCycle} companyPrefix={ctx.companyPrefix ?? null} />
            <ResearchCyclePhaseGraph cycle={data.researchCycle} />
            {data.researchCycle.totalPhases === 1 && data.researchCycle.nodes.length > 1 ? (
              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: COLORS.muted,
                  fontSize: 11,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                All nodes are currently in a single detected phase. If you expected multi-phase sequencing,
                ensure child issues keep explicit dependency edges (`blockedBy`) so the cycle depth can be
                visualized as P1→P2→P3.
              </div>
            ) : null}
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>
                Transition diagram (block-flow)
              </div>
              <ResearchCycleBlockDiagram cycle={data.researchCycle} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function SidebarLink(_props: PluginSidebarProps) {
  const ctx = useHostContext();
  const href = ctx.companyPrefix
    ? `/${ctx.companyPrefix}/research-chat`
    : `/plugins/dl-research.chat/research-chat`;
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 14,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#06d6a0",
          boxShadow: "0 0 8px #06d6a088",
        }}
      />
      Research Chat
    </a>
  );
}

export function SidebarCycleLink(_props: PluginSidebarProps) {
  const ctx = useHostContext();
  const href = ctx.companyPrefix
    ? `/${ctx.companyPrefix}/research-cycle`
    : `/plugins/dl-research.chat/research-cycle`;
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        fontSize: 14,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: COLORS.accent,
          boxShadow: `0 0 8px ${COLORS.accent}88`,
        }}
      />
      Research Cycle
    </a>
  );
}
