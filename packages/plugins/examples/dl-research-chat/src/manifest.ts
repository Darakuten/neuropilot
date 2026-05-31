import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "dl-research.chat",
  apiVersion: 1,
  version: "0.2.0",
  displayName: "Research Chat",
  description:
    "Slack-style chat between the operator and the PI agent. Used for crystallizing research hypotheses before launching experiments. Each user turn appends to the discussion issue and wakes PI to reply.",
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
        id: "chat",
        displayName: "Research Chat",
        routePath: "research-chat",
        exportName: "ResearchChatPage",
      },
      {
        type: "page",
        id: "cycle-visualizer",
        displayName: "Research Cycle",
        routePath: "research-cycle",
        exportName: "ResearchCyclePage",
      },
      {
        type: "sidebar",
        id: "chat-link",
        displayName: "Research Chat",
        exportName: "SidebarLink",
      },
      {
        type: "sidebar",
        id: "cycle-link",
        displayName: "Research Cycle",
        exportName: "SidebarCycleLink",
      },
    ],
  },
};

export default manifest;
