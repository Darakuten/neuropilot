import { useCallback, useMemo, useState } from "react";
import {
  usePluginAction,
  usePluginData,
  useHostContext,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";

type MatrixCell = "desired" | "required" | "off";

type MatrixSkill = {
  id: string;
  key: string;
  slug: string;
  isAdapterDefault: boolean;
};

type MatrixAgent = {
  agentId: string;
  agentName: string;
  agentRole: string;
  cells: Record<string, MatrixCell>;
};

type MatrixPayload = {
  companyId: string;
  skills: MatrixSkill[];
  agents: MatrixAgent[];
  fetchedAt: string;
};

const SOURCE_LABEL: Record<string, string> = {
  "paperclipai/paperclip": "Paperclip",
  "composiohq/awesome-claude-skills": "Composio",
  "wanshuiyin/auto-claude-code-research-in-sleep": "Auto-research",
};

function sourceFromKey(key: string): string {
  const [org, repo] = key.split("/");
  return SOURCE_LABEL[`${org}/${repo}`] ?? `${org}/${repo}`;
}

const headerRowStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: "var(--background, #fff)",
  zIndex: 2,
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "1px solid var(--border, #ddd)",
  whiteSpace: "nowrap",
};

const stickyAgentColStyle: React.CSSProperties = {
  position: "sticky",
  left: 0,
  background: "var(--background, #fff)",
  zIndex: 1,
  padding: "8px 6px",
  borderRight: "1px solid var(--border, #ddd)",
  borderBottom: "1px solid var(--border, #eee)",
  whiteSpace: "nowrap",
  fontWeight: 500,
};

const cellStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "4px 6px",
  borderBottom: "1px solid var(--border, #f1f1f1)",
};

export function SkillMatrixPage(_props: PluginPageProps) {
  const ctx = useHostContext();
  const companyId = ctx.companyId;
  const { data, loading, error, refresh } = usePluginData<MatrixPayload>("matrix", {
    companyId: companyId ?? "",
  });
  const toggle = usePluginAction("toggleSkill");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "research" | "utility" | "paperclip">("all");

  const filteredSkills = useMemo(() => {
    if (!data) return [];
    return data.skills.filter((s) => {
      if (filter === "all") return true;
      if (filter === "research") return s.key.startsWith("wanshuiyin/");
      if (filter === "utility") return s.key.startsWith("composiohq/");
      if (filter === "paperclip") return s.key.startsWith("paperclipai/");
      return true;
    });
  }, [data, filter]);

  const handleToggle = useCallback(
    async (agentId: string, skillKey: string, currentlyOn: boolean) => {
      setBusy(`${agentId}:${skillKey}`);
      try {
        await toggle({ agentId, skillKey, enable: !currentlyOn });
        refresh();
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert(`Failed to toggle: ${(err as Error).message}`);
      } finally {
        setBusy(null);
      }
    },
    [toggle, refresh],
  );

  if (!companyId) {
    return <div style={{ padding: 24 }}>Open this page from a company-scoped route.</div>;
  }
  if (loading) return <div style={{ padding: 24 }}>Loading skill matrix…</div>;
  if (error) return <div style={{ padding: 24, color: "crimson" }}>Error: {error.message}</div>;
  if (!data) return <div style={{ padding: 24 }}>No data.</div>;

  return (
    <div style={{ padding: 24, display: "grid", gap: 12 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Skill Matrix</h1>
          <small style={{ opacity: 0.6 }}>
            {data.agents.length} agents × {filteredSkills.length}/{data.skills.length} skills · refreshed{" "}
            {new Date(data.fetchedAt).toLocaleTimeString()}
          </small>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>
            Filter:&nbsp;
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All ({data.skills.length})</option>
              <option value="research">Research only</option>
              <option value="utility">Utility (PDF/PPTX/XLSX)</option>
              <option value="paperclip">Paperclip core</option>
            </select>
          </label>
          <button onClick={refresh}>Refresh</button>
        </div>
      </header>

      <div style={{ overflow: "auto", maxHeight: "75vh", border: "1px solid var(--border, #ddd)", borderRadius: 6 }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...headerRowStyle, ...stickyAgentColStyle }}>Agent</th>
              {filteredSkills.map((s) => (
                <th key={s.key} style={{ ...headerRowStyle, writingMode: "vertical-rl" as const, fontWeight: 500 }}
                    title={`${s.key} (${sourceFromKey(s.key)})`}>
                  <span style={{ fontWeight: s.isAdapterDefault ? 400 : 600, opacity: s.isAdapterDefault ? 0.6 : 1 }}>
                    {s.slug}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ ...stickyAgentColStyle, fontStyle: "italic", fontWeight: 400, opacity: 0.6 }}>source</th>
              {filteredSkills.map((s) => (
                <th key={s.key} style={{ ...cellStyle, fontStyle: "italic", fontWeight: 400, opacity: 0.6, fontSize: 11 }}>
                  {sourceFromKey(s.key).slice(0, 5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.agents.map((row) => (
              <tr key={row.agentId}>
                <td style={stickyAgentColStyle}>
                  {row.agentName}
                  <small style={{ display: "block", opacity: 0.5, fontWeight: 400 }}>{row.agentRole}</small>
                </td>
                {filteredSkills.map((s) => {
                  const state = row.cells[s.key] ?? "off";
                  const cellId = `${row.agentId}:${s.key}`;
                  const isBusy = busy === cellId;
                  if (state === "required") {
                    return (
                      <td key={cellId} style={{ ...cellStyle, color: "#888" }} title="Adapter-required (auto)">
                        ●
                      </td>
                    );
                  }
                  return (
                    <td key={cellId} style={cellStyle}>
                      <input
                        type="checkbox"
                        checked={state === "desired"}
                        disabled={isBusy}
                        onChange={() => handleToggle(row.agentId, s.key, state === "desired")}
                        title={isBusy ? "Saving…" : `${row.agentName} ⇄ ${s.slug}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer style={{ fontSize: 12, opacity: 0.7 }}>
        ☑ user-checked · ● adapter-required (auto-installed) · empty = off
      </footer>
    </div>
  );
}

export function SidebarLink(_props: PluginSidebarProps) {
  const ctx = useHostContext();
  const href = ctx.companyPrefix
    ? `/${ctx.companyPrefix}/skill-matrix`
    : `/plugins/dl-research.skill-matrix/skill-matrix`;
  return (
    <a href={href} style={{ display: "block", padding: "6px 12px", fontSize: 14 }}>
      Skill Matrix
    </a>
  );
}
