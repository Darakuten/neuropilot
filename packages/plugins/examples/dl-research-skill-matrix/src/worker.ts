import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const API_BASE = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const DEFAULT_PAPERCLIP_DEFAULT_KEYS = new Set([
  "paperclipai/paperclip/diagnose-why-work-stopped",
  "paperclipai/paperclip/paperclip",
  "paperclipai/paperclip/paperclip-converting-plans-to-tasks",
  "paperclipai/paperclip/paperclip-create-agent",
  "paperclipai/paperclip/paperclip-create-plugin",
  "paperclipai/paperclip/paperclip-dev",
  "paperclipai/paperclip/para-memory-files",
  "paperclipai/paperclip/terminal-bench-loop",
]);

type CompanySkill = { id: string; key: string; slug: string };
type AgentRow = { id: string; name: string; role: string };
type AgentSkillSnapshot = {
  desiredSkills: string[];
  entries: Array<{ key: string; required?: boolean }>;
};

type MatrixCell = "desired" | "required" | "off";
type MatrixRow = {
  agentId: string;
  agentName: string;
  agentRole: string;
  cells: Record<string, MatrixCell>;
};
type MatrixPayload = {
  companyId: string;
  skills: Array<{ id: string; key: string; slug: string; isAdapterDefault: boolean }>;
  agents: MatrixRow[];
  fetchedAt: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    ...(init ?? {}),
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) {
    throw new Error(`API ${init?.method ?? "GET"} ${path} -> ${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as T;
}

async function buildMatrix(companyId: string): Promise<MatrixPayload> {
  const [skills, agents] = await Promise.all([
    api<CompanySkill[]>(`/api/companies/${companyId}/skills`),
    api<AgentRow[]>(`/api/companies/${companyId}/agents`),
  ]);

  const skillRows = skills
    .filter((s) => !s.key.startsWith(`company/${companyId}/`))
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((s) => ({
      id: s.id,
      key: s.key,
      slug: s.slug,
      isAdapterDefault: DEFAULT_PAPERCLIP_DEFAULT_KEYS.has(s.key),
    }));

  const agentRows: MatrixRow[] = await Promise.all(
    agents
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (a): Promise<MatrixRow> => {
        const snapshot = await api<AgentSkillSnapshot>(`/api/agents/${a.id}/skills`);
        const desiredSet = new Set(snapshot.desiredSkills ?? []);
        const requiredSet = new Set(
          (snapshot.entries ?? []).filter((e) => e.required).map((e) => e.key),
        );
        const cells: Record<string, MatrixCell> = {};
        for (const skill of skillRows) {
          if (requiredSet.has(skill.key)) cells[skill.key] = "required";
          else if (desiredSet.has(skill.key)) cells[skill.key] = "desired";
          else cells[skill.key] = "off";
        }
        return {
          agentId: a.id,
          agentName: a.name,
          agentRole: a.role,
          cells,
        };
      }),
  );

  return {
    companyId,
    skills: skillRows,
    agents: agentRows,
    fetchedAt: new Date().toISOString(),
  };
}

async function toggleSkill(input: {
  agentId: string;
  skillKey: string;
  enable: boolean;
}): Promise<{ desiredSkills: string[] }> {
  const { agentId, skillKey, enable } = input;
  const snapshot = await api<AgentSkillSnapshot>(`/api/agents/${agentId}/skills`);
  const current = new Set(snapshot.desiredSkills ?? []);
  if (enable) current.add(skillKey);
  else current.delete(skillKey);
  const next = await api<AgentSkillSnapshot>(`/api/agents/${agentId}/skills/sync`, {
    method: "POST",
    body: JSON.stringify({ desiredSkills: Array.from(current) }),
  });
  return { desiredSkills: next.desiredSkills };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register("matrix", async (params) => {
      const companyId = typeof params.companyId === "string" ? params.companyId : null;
      if (!companyId) {
        throw new Error("companyId required");
      }
      return buildMatrix(companyId);
    });

    ctx.actions.register("toggleSkill", async (params) => {
      const agentId = typeof params.agentId === "string" ? params.agentId : "";
      const skillKey = typeof params.skillKey === "string" ? params.skillKey : "";
      const enable = params.enable === true;
      if (!agentId || !skillKey) throw new Error("agentId and skillKey required");
      return toggleSkill({ agentId, skillKey, enable });
    });

    ctx.logger.info("Skill Matrix plugin ready", { apiBase: API_BASE });
  },

  async onHealth() {
    return { status: "ok", message: `Skill Matrix worker pointed at ${API_BASE}` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
