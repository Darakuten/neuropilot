# Skill Matrix — DL Research

This file is the **declarative source of truth** for which skill belongs to which
agent. It mirrors the `skills:` frontmatter inside each `agents/<role>/AGENTS.md`
and the `desiredSkills` value Paperclip stores per agent.

There are three places to control the same checklist; they should stay in sync:

1. `companies/dl-research/agents/<role>/AGENTS.md` (`skills:` frontmatter — version controlled).
2. Paperclip UI → `Company → Agents → <Agent> → Skills` (interactive checkboxes — `agentsApi.syncSkills`).
3. REST API: `POST /api/agents/<agentId>/skills/sync` with `{ desiredSkills: [...] }`.

Re-running `pnpm paperclipai company import companies/dl-research --target existing --company-id <id>`
will reconcile (1) → (2)/(3).

## Legend

- `[x]` desired (will be installed for this agent)
- `[ ]` not desired
- `[*]` adapter-required (auto-added by the runtime adapter, e.g. `paperclipai/paperclip/*`)
- Skill source prefixes:
  - `paperclipai/paperclip/*` → built-in Paperclip skills (auto-installed by adapter)
  - `composiohq/awesome-claude-skills/*` → general utilities (referenced or vendored)
  - `wanshuiyin/auto-claude-code-research-in-sleep/*` → research workflows (vendored)
  - `dl-research/custom/*` → company-private custom skills

## User-controlled skill assignment (excluding adapter-required defaults)

The cursor adapter automatically installs the eight `paperclipai/paperclip/*`
skills into every agent. The matrix below shows only the **user-controlled** layer.

### Custom (DL Research-private)

| Skill | Source | Class | PI | Ideator | Lit Scout | Experimenter | Engineer | Critic | Writer | Worker | Mentor |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `research-discussion` | dl-research/custom | governance | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `vault-reader` | dl-research/custom | company-private | [x] | [x] | [x] | [x] | [ ] | [x] | [x] | [ ] | [x] |
| `web-research` | dl-research/custom | research-core | [x] | [x] | [x] | [ ] | [ ] | [x] | [ ] | [ ] | [x] |
| `scrapling-research-harvest` | dl-research/custom | research-core | [x] | [ ] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `autosota-topology-optimizer` | dl-research/custom | governance | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] |
| `pika-meeting-bridge` | dl-research/custom | writing | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] |

### Research workflows (wanshuiyin/auto-claude-code-research-in-sleep, vendored)

| Skill | Class | PI | Ideator | Lit Scout | Experimenter | Engineer | Critic | Writer | Worker | Mentor |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `paperclip` | governance | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] |
| `paper-plan` | research | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [x] |
| `paper-write` | research | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `paper-write-matsuo` | research | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `paper-typeset` | publication | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `paper-revise` | research | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [x] | [ ] | [x] |
| `paper-poster` | research | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `paper-slides` | research | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `prior-art-search` | research | [x] | [x] | [x] | [ ] | [ ] | [x] | [ ] | [ ] | [x] |
| `arxiv-watch` | research | [ ] | [x] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `citation-audit` | research | [ ] | [ ] | [x] | [ ] | [ ] | [x] | [x] | [ ] | [ ] |
| `paper-claim-audit` | research | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] | [ ] |
| `exp-plan` | research | [ ] | [ ] | [ ] | [x] | [ ] | [ ] | [ ] | [ ] | [ ] |
| `exp-runner` | research | [ ] | [ ] | [ ] | [x] | [x] | [ ] | [ ] | [ ] | [ ] |
| `exp-checker` | research | [ ] | [ ] | [ ] | [x] | [x] | [x] | [ ] | [ ] | [ ] |

### Office utilities (composiohq/awesome-claude-skills)

| Skill | Class | PI | Ideator | Lit Scout | Experimenter | Engineer | Critic | Writer | Worker | Mentor |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `pdf` | utility | [x] | [x] | [x] | [ ] | [ ] | [x] | [x] | [ ] | [ ] |
| `pptx` | utility | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `xlsx` | utility | [x] | [ ] | [ ] | [x] | [ ] | [ ] | [x] | [ ] | [ ] |
| `docx` | utility | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |

### Visual / writing utilities (composiohq/awesome-claude-skills)

| Skill | Class | PI | Ideator | Lit Scout | Experimenter | Engineer | Critic | Writer | Worker | Mentor |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `content-research-writer` | writing | [ ] | [x] | [x] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `internal-comms` | writing | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [x] |
| `artifacts-builder` | visual | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `canvas-design` | visual | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `image-enhancer` | visual | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |
| `theme-factory` | visual | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] |

### Engineering utilities (composiohq/awesome-claude-skills)

| Skill | Class | PI | Ideator | Lit Scout | Experimenter | Engineer | Critic | Writer | Worker | Mentor |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `file-organizer` | engineering | [ ] | [ ] | [ ] | [x] | [x] | [ ] | [ ] | [x] | [ ] |
| `changelog-generator` | engineering | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] | [x] | [ ] |
| `mcp-builder` | engineering | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] | [ ] | [ ] |
| `webapp-testing` | engineering | [ ] | [ ] | [ ] | [ ] | [x] | [ ] | [ ] | [ ] | [ ] |

## Per-agent skill counts

| Agent | Custom | Research | Office | Visual/Writing | Engineering | Total |
|---|---:|---:|---:|---:|---:|---:|
| PI | 6 | 3 | 3 | 1 | 0 | **13** |
| Ideator | 2 | 3 | 1 | 1 | 0 | **8** (eff. 7 if no docx) |
| Lit Scout | 3 | 3 | 1 | 1 | 0 | **8** |
| Experimenter | 1 | 3 | 1 | 0 | 1 | **6** |
| Engineer | 0 | 2 | 0 | 0 | 4 | **6** |
| Critic | 2 | 4 | 1 | 0 | 0 | **8** (eff. 7 + paper-revise) |
| Writer | 1 | 7 | 4 | 4 | 0 | **19** |
| Worker | 0 | 1 | 0 | 0 | 2 | **3** |
| Mentor | 4 | 3 | 0 | 1 | 0 | **8** |

(Adapter auto-adds 8 paperclipai built-ins on top of all of these.)

## How to change

- **Declarative** (recommended): edit `agents/<role>/AGENTS.md`, then
  `pnpm paperclipai company import companies/dl-research --target existing --company-id <id>`.
- **Interactive**: open the Paperclip UI → Company → Agents → <Agent> → Skills tab.
- **Programmatic**: `POST /api/agents/<id>/skills/sync` with
  `{"desiredSkills": ["research-discussion", "vault-reader", ...]}`.

All three converge on the same `agent_desired_skills` table.
