import { describe, expect, it, beforeEach, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

const fakeAgents = [
  { id: "ag-pi", name: "PI", role: "agent" },
  { id: "ag-writer", name: "Writer", role: "agent" },
];

const fakeSkills = [
  { id: "sk-paperclip", key: "paperclipai/paperclip/paperclip", slug: "paperclip" },
  { id: "sk-pdf", key: "composiohq/awesome-claude-skills/pdf", slug: "pdf" },
  {
    id: "sk-paper-write",
    key: "wanshuiyin/auto-claude-code-research-in-sleep/paper-write",
    slug: "paper-write",
  },
];

const desiredByAgent: Record<string, string[]> = {
  "ag-pi": ["paperclipai/paperclip/paperclip"],
  "ag-writer": [
    "paperclipai/paperclip/paperclip",
    "wanshuiyin/auto-claude-code-research-in-sleep/paper-write",
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const u = url.replace(/^https?:\/\/[^/]+/, "");
    if (u === "/api/companies/co-1/skills") return jsonResponse(fakeSkills);
    if (u === "/api/companies/co-1/agents") return jsonResponse(fakeAgents);
    const skillsMatch = /\/api\/agents\/(.+)\/skills$/.exec(u);
    if (skillsMatch) {
      return jsonResponse({
        desiredSkills: desiredByAgent[skillsMatch[1]] ?? [],
        entries: [{ key: "paperclipai/paperclip/paperclip", required: true }],
      });
    }
    const syncMatch = /\/api\/agents\/(.+)\/skills\/sync$/.exec(u);
    if (syncMatch) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      desiredByAgent[syncMatch[1]] = body.desiredSkills;
      return jsonResponse({
        desiredSkills: body.desiredSkills,
        entries: [{ key: "paperclipai/paperclip/paperclip", required: true }],
      });
    }
    return new Response("not mocked", { status: 404 });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dl-research-skill-matrix plugin", () => {
  it("builds the matrix from host API", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const matrix = await harness.getData<{
      agents: Array<{ agentName: string; cells: Record<string, string> }>;
      skills: Array<{ slug: string }>;
    }>("matrix", { companyId: "co-1" });
    expect(matrix.agents).toHaveLength(2);
    expect(matrix.skills.map((s) => s.slug).sort()).toEqual(["paper-write", "paperclip", "pdf"]);
    const writer = matrix.agents.find((a) => a.agentName === "Writer")!;
    expect(writer.cells["wanshuiyin/auto-claude-code-research-in-sleep/paper-write"]).toBe("desired");
    const pi = matrix.agents.find((a) => a.agentName === "PI")!;
    expect(pi.cells["composiohq/awesome-claude-skills/pdf"]).toBe("off");
  });

  it("toggles a skill on for an agent", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{ desiredSkills: string[] }>("toggleSkill", {
      agentId: "ag-pi",
      skillKey: "composiohq/awesome-claude-skills/pdf",
      enable: true,
    });
    expect(result.desiredSkills).toContain("composiohq/awesome-claude-skills/pdf");
  });

  it("toggles a skill off for an agent", async () => {
    const harness = createTestHarness({ manifest, capabilities: [...manifest.capabilities] });
    await plugin.definition.setup(harness.ctx);
    const result = await harness.performAction<{ desiredSkills: string[] }>("toggleSkill", {
      agentId: "ag-writer",
      skillKey: "wanshuiyin/auto-claude-code-research-in-sleep/paper-write",
      enable: false,
    });
    expect(result.desiredSkills).not.toContain(
      "wanshuiyin/auto-claude-code-research-in-sleep/paper-write",
    );
  });
});
