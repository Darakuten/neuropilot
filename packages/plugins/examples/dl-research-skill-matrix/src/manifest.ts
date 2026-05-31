import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "dl-research.skill-matrix",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Skill Matrix",
  description:
    "Agent x Skill checklist matrix. Lets a board user see all agent skill assignments at a glance and toggle them with checkboxes.",
  author: "DL Research",
  categories: ["ui"],
  capabilities: [
    "http.outbound",
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "matrix",
        displayName: "Skill Matrix",
        routePath: "skill-matrix",
        exportName: "SkillMatrixPage",
      },
      {
        type: "sidebar",
        id: "matrix-link",
        displayName: "Skill Matrix",
        exportName: "SidebarLink",
      },
    ],
  },
};

export default manifest;
