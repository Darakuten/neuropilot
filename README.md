# NeuroPilot

<p align="center">
  <strong>Premium AI-native research operating system for Neuroengineering & Neuroscience</strong><br/>
  Multi-agent orchestration for ML/DL-first neural research teams.
</p>

<p align="center">
  <img alt="domain" src="https://img.shields.io/badge/Domain-Neuroengineering%20%2F%20Neuroscience-7c3aed">
  <img alt="stack" src="https://img.shields.io/badge/Stack-ML%20%2F%20DL%20%2F%20LLM-0ea5e9">
  <img alt="orchestration" src="https://img.shields.io/badge/Mode-Multi--Agent%20Research%20Ops-10b981">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-f59e0b">
</p>

<p align="center">
  <a href="doc/visualizations/dl-research-overview.html"><strong>Architecture Overview</strong></a> ·
  <a href="#workflow-demo"><strong>Workflow Demo</strong></a> ·
  <a href="companies/dl-research"><strong>DL Research Company Package</strong></a>
</p>

---

## Product Overview

NeuroPilot is a Paperclip-based control plane purpose-built for
**AI-first neuroengineering and neuroscience research operations**.

It coordinates specialized agents for:

- hypothesis generation for neural systems
- prior-art and citation-grounded literature scouting
- ML/DL experiment planning and execution
- claim-evidence integrity audit
- paper/poster/slides production for submission workflows

## Why PI teams use this

- **Single command center**: strategy, execution, and review in one dashboard
- **Traceable science**: issues/comments/runs preserve full decision and evidence history
- **Governed autonomy**: heartbeat automation with budget and approval gates
- **Faster paper loop**: from idea to draft with structured QA checkpoints

## Workflow Demo

This project is best understood as a single, continuous workflow:
**hypothesis generation -> experiment execution -> paper artifact generation**.

Schematic preview (deterministic HTML timeline): [`doc/visualizations/neuropilot-demo.html`](doc/visualizations/neuropilot-demo.html)

Timeline:

- **00:00-00:06** Hypothesis generation (issue + owner + success criteria)
- **00:06-00:12** Experiment execution (run progress, logs, artifacts)
- **00:12-00:19** Claim/citation audit gate
- **00:19-00:25** Paper output generation (PDF/slides/poster)

Recording playbook: [`doc/DEMO_VIDEO_PLAYBOOK.md`](doc/DEMO_VIDEO_PLAYBOOK.md)

Generate GIF/MP4/PDF/PNG artifacts locally when needed (not committed by default):

```bash
node doc/visualizations/render-demo.mjs
node doc/visualizations/render-pdf.mjs
```

## Domain Specialization

- **Research domain**: neural signals, BCI, neurophysiology, computational neuroscience
- **Methods domain**: ML/DL pipelines, representation learning, reproducibility-first evaluation
- **Ops domain**: evidence traceability, citation/claim audits, PI-centric approval gates

## Demo

- **Workflow schematic source**: `doc/visualizations/neuropilot-demo.html`
- **Architecture source**: `doc/visualizations/dl-research-overview.html`
- **Local render scripts**: `doc/visualizations/render-demo.mjs`, `doc/visualizations/render-pdf.mjs`
- **Recording playbook**: `doc/DEMO_VIDEO_PLAYBOOK.md`

## PI demo flow (5 minutes)

1. Start a local instance in your own environment (`pnpm dev`)
2. Inspect active research themes and issue backlog
3. Open a run transcript and verify model/experiment context
4. Check evidence artifacts and claim audit trail
5. Review approval checkpoints before publication output

## Quickstart

```bash
pnpm install
pnpm dev
```

Then open:

- API/UI: `http://localhost:3100`

## Safety note

- Do not publish direct local dashboard URLs in public docs.
- Running agents may consume model tokens/costs depending on local configuration.
- Keep dashboard access private and enable explicit approval/budget gates before execution.
- Use a pre-recorded demo for public sharing; avoid live runs in open presentations.

## Import the research company

```bash
pnpm paperclipai company import companies/dl-research --target new --newCompanyName "DL Research"
```

## Repo map

- `companies/dl-research/`: domain-specific company package (agents, tasks, skills, projects)
- `server/`: orchestration API, heartbeat execution, governance services
- `ui/`: board dashboard and operator UX
- `packages/plugins/examples/dl-research-*`: research plugin examples
- `doc/visualizations/`: overview/demo HTML sources and local render scripts

## GitHub Social Preview setup

GitHub repo Social Preview can be set from repository settings.
Generate the image first, then upload from repository settings:

- Generate with: `node doc/visualizations/render-pdf.mjs`
- Output image: `doc/visualizations/dl-research-overview.png`
- Recommended text: `NeuroPilot — AI × Neuroengineering / Neuroscience`

## Project policy for GitHub top

To avoid misleading repository presentation:

- We do **not** include Star History or badges tied to other repositories
- We do **not** keep inherited upstream marketing sections that do not represent this fork
- We keep this README focused on DLR-specific scope and evidence-backed capabilities

## License

MIT
