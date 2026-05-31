# DL Research

DL Research is an autonomous research company package for Paperclip.

It is designed to orchestrate a full research lifecycle:

- idea generation and literature scanning
- experiment planning and execution
- evidence and claim auditing
- paper writing, poster/slides production, and rebuttal preparation

## Workflow

1. PI defines priorities and approves strategy checkpoints.
2. Ideator and Lit Scout propose and validate promising directions.
3. Experimenter and Engineer implement and run experiments.
4. Critic audits logic, citations, and claim-to-evidence consistency.
5. Writer assembles publication artifacts.
6. Worker handles ad-hoc operations and coordination tasks.
7. Mentor provides periodic strategic feedback.

## Org Chart

| Agent | Title | Reports To | Core Skills |
|---|---|---|---|
| `pi` | Principal Investigator / CEO | `null` | `paperclip`, `paper-plan`, `research-pipeline` |
| `ideator` | Research Ideator | `pi` | `idea-discovery`, `prior-art-search` |
| `lit-scout` | Literature Scout | `pi` | `arxiv-watch`, `prior-art-search`, `citation-audit` |
| `experimenter` | Research Experimenter | `pi` | `exp-plan`, `exp-runner`, `training-check` |
| `engineer` | Research Engineer | `experimenter` | `exp-runner`, `system-profile`, `vast-gpu` |
| `critic` | Research Critic | `pi` | `paper-claim-audit`, `citation-audit`, `proof-checker` |
| `writer` | Paper Writer | `pi` | `paper-write`, `paper-revise`, `paper-poster`, `paper-slides` |
| `worker` | Research Operations Worker | `pi` | `experiment-queue`, `paperclip` |
| `mentor` | Research Mentor | `pi` | `research-review`, `specification-writing` |

## Included Projects

- `company-ops`: governance and routine operation tasks
- `research-theme-template`: reusable template for new research themes
- `neurips-2026-submodular-lt`: concrete flagship research project seed

## Getting Started

```bash
pnpm paperclipai company import companies/dl-research --target new --newCompanyName "DL Research"
```

## References

- [Agent Companies Specification](https://agentcompanies.io/specification)
- [Paperclip](https://github.com/paperclipai/paperclip)
- [Auto-claude-code-research-in-sleep](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep)
- [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
