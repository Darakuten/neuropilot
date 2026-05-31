# Adapter & Model Strategy — DL Research

Decided 2026-05-03 after `claude_local` OAuth expiry caused PI to fail in
production.

## Why a single Cursor adapter (not per-agent provider)

Originally each agent ran on `claude_local`. That had three operational
problems for an autonomous research lab:

1. **OAuth single point of failure** — Claude Code stores credentials in the
   macOS Keychain. The token expires every ~30–60 days and the silent
   refresh sometimes fails. When it fails, every `claude_local` agent dies
   with `401 Invalid authentication credentials`.
2. **Model lock-in** — Some research tasks are better served by GPT-5 codex
   (heavy iterative code), Gemini Flash (cheap batch summarization), etc.
   Mixing required different adapters per agent.
3. **Subscription vs metered** — A flat-fee Claude Code subscription is great
   for low-frequency governance agents but explodes pay-per-token if used as
   the bulk worker tier.

We solved this with **Cursor CLI as the single adapter**:

- One auth surface (Cursor login) that gives access to the full Anthropic +
  OpenAI + Gemini + Grok + Kimi catalog.
- Per-agent `model` is a free dial; switching is one PATCH call.
- Cursor's hosted billing rolls everything into one subscription invoice.
- The OAuth token is managed by Cursor; if it ever fails, swap to
  `CURSOR_API_KEY` (zero-downtime API-key fallback path).

## Per-agent model assignment

Verified against `cursor-agent` build `2026.05.01-eea359f`. Update the IDs
when Cursor releases new models.

| Agent | Model | Reasoning |
|---|---|---|
| **PI** | `claude-4.6-opus-high-thinking` | Strategy + final accept/reject decisions; depth > speed. |
| **Ideator** | `claude-4.6-opus-high` | Creative ideation; Opus is strongest for novel synthesis. |
| **Mentor** | `claude-4.6-opus-high-thinking` | Monthly external view; reasoning-heavy. |
| **Critic** | `claude-4.6-sonnet-medium-thinking` | Mid-frequency rigorous review; Sonnet is fast enough to gate every PR. |
| **Writer** | `claude-4.6-opus-high` | Per-deliverable; quality of prose and citation matters. |
| **Lit Scout** | `gemini-3-flash` | Daily scheduled bulk literature scan; Flash is cheapest at acceptable recall. |
| **Experimenter** | `gpt-5.2-codex-high` | Plan-heavy + light coding; Codex high reasoning. |
| **Engineer** | `gpt-5.3-codex-fast` | Tight code-write/test loop; Codex fast variant. |
| **Worker** | `gpt-5.1-codex-mini` | Ad-hoc operational tasks; mini keeps cost negligible. |

## Heartbeat configuration

| Agent | Heartbeat | Why |
|---|---|---|
| All except Experimenter | `enabled: false`, `wakeOnDemand: true` | Wake on issue assignment / routine trigger / explicit invoke. Keeps cost predictable. |
| Experimenter | `enabled: true`, `intervalSec: 1800` | Half-hourly tick so long experiment loops can re-check progress without external nudge. |

## Routines

Cron schedules (Asia/Tokyo) defined in `.paperclip.yaml`:

- `weekly-pi-review` — Mondays 09:00 → wakes PI for the week's prioritization.
- `lit-watch-daily` — Daily 06:00 → wakes Lit Scout to scan arXiv.
- `monthly-budget-check` — 1st of month 10:00 → reviews budget vs run.

## Failure modes & fallbacks

| Failure | Symptom | Recovery |
|---|---|---|
| Cursor login expired | `401`/`Not logged in` | `cursor-agent login` (interactive) or set `CURSOR_API_KEY` env. |
| Cursor model name retired | `Cannot use this model: <name>` | Run `cursor-agent --list-models`, update the `model` field via UI or PATCH. |
| Cursor service degraded | Long latency / `503` | Switch the affected agent to `claude_local` adapter with `ANTHROPIC_API_KEY` fallback. |
| Subscription quota hit | `429` / rate limit messages | Move high-volume agents (Lit Scout, Worker) to a metered API tier or a cheaper local model via `http` adapter. |

## How to change models later

```bash
# Single agent:
curl -X PATCH "$URL/api/agents/<id>" \
  -H "Content-Type: application/json" \
  -d '{"adapterType":"cursor","adapterConfig":{"model":"claude-4.6-opus-max-thinking"},"replaceAdapterConfig":false}'

# Whole package (declarative, version controlled):
# Edit companies/dl-research/.paperclip.yaml `agents.<role>.adapter.config.model`
# then re-import:
pnpm paperclipai company import companies/dl-research \
  --target existing --company-id 9ee79153-1b3b-4314-ad96-ee3fc9872238
```

## Why we did NOT use `claude_local + ANTHROPIC_API_KEY`

It would solve the OAuth expiry, but:

- still single-provider (no GPT-5 codex / Gemini Flash routing)
- per-token billing instead of subscription cap
- worse cost predictability for autonomous loops
