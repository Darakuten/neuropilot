# DLR Autonomous Research Ops

<p align="center">
  <strong>AI × Neuroengineering / Neuroscience に特化した研究自動化オペレーティングシステム</strong><br/>
  Multi-agent orchestration for ML/DL-first neural research teams.
</p>

<p align="center">
  <img alt="domain" src="https://img.shields.io/badge/Domain-Neuroengineering%20%2F%20Neuroscience-7c3aed">
  <img alt="stack" src="https://img.shields.io/badge/Stack-ML%20%2F%20DL%20%2F%20LLM-0ea5e9">
  <img alt="orchestration" src="https://img.shields.io/badge/Mode-Multi--Agent%20Research%20Ops-10b981">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-f59e0b">
</p>

<p align="center">
  <img src="doc/visualizations/dl-research-overview.png" alt="DLR overview" width="920" />
</p>

<p align="center">
  <a href="http://127.0.0.1:3100/DLR/dashboard"><strong>Live Dashboard (Local)</strong></a> ·
  <a href="doc/visualizations/dl-research-overview.png"><strong>Social Preview Image</strong></a> ·
  <a href="companies/dl-research"><strong>DL Research Company Package</strong></a> ·
  <a href="doc/visualizations/dl-research-overview.pdf"><strong>Architecture PDF</strong></a>
</p>

---

## 日本語サマリー

DLR Autonomous Research Ops は、**AI × 神経工学 / 神経科学**の研究運用に特化したマルチエージェント制御基盤です。  
仮説立案、先行研究調査、ML/DL実験、主張監査、論文成果物作成までを、一つのオペレーションレイヤーで統合します。

### このリポジトリが強い領域

- **対象領域**: neural signals, BCI, neurophysiology, computational neuroscience
- **手法領域**: ML/DL, representation learning, 再現性検証, 比較評価
- **運用領域**: 研究ログ追跡、証拠連結、citation/claim audit、PIレビュー

## English Summary

DLR Autonomous Research Ops is a Paperclip-based control plane purpose-built for
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

## Demo

- **PI dashboard**: `http://127.0.0.1:3100/DLR/dashboard`
- **Architecture preview**: `doc/visualizations/dl-research-overview.png`
- **Presentation PDF**: `doc/visualizations/dl-research-overview.pdf`

## PI demo flow (5 minutes)

1. Open `http://127.0.0.1:3100/DLR/dashboard`
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
- DLR dashboard: `http://127.0.0.1:3100/DLR/dashboard`

## Import the research company

```bash
pnpm paperclipai company import companies/dl-research --target new --newCompanyName "DL Research"
```

## Repo map

- `companies/dl-research/`: domain-specific company package (agents, tasks, skills, projects)
- `server/`: orchestration API, heartbeat execution, governance services
- `ui/`: board dashboard and operator UX
- `packages/plugins/examples/dl-research-*`: research plugin examples
- `doc/visualizations/`: overview visual assets for PI presentation

## GitHub Social Preview setup

GitHub repo Social Preview can be set from repository settings.
Use this image for a clean PI-facing card:

- Recommended image: `doc/visualizations/dl-research-overview.png`
- Recommended text: `DLR Autonomous Research Ops — AI × Neuroengineering / Neuroscience`

## Project policy for GitHub top

To avoid misleading repository presentation:

- We do **not** include Star History or badges tied to other repositories
- We do **not** keep inherited upstream marketing sections that do not represent this fork
- We keep this README focused on DLR-specific scope and evidence-backed capabilities

## License

MIT
