# dl-research-chat (Paperclip plugin)

Slack-style chat between the operator (you) and the **PI** agent for
crystallizing research hypotheses **before** experiments are launched.

## What it does

- Auto-creates a long-lived `Research Discussion` project + a single
  `Research hypothesis discussion (PI ↔ Operator)` issue when first opened.
- Each message you type becomes a comment on that issue and **wakes PI**.
  PI follows the `research-discussion` skill: short conversational replies,
  vault grounding via `vault-reader`, citations via `web-research`.
- Live `PI is thinking… Ns` indicator while a heartbeat is running.
- Polls every 4 s for new messages and run state.
- Shows the model PI is currently configured with so you know what's
  answering.

## Build + install

```sh
cd packages/plugins/examples/dl-research-chat
pnpm install
pnpm build
# install (point at the local dist; no publish needed)
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H 'Content-Type: application/json' \
  -d "{\"source\":\"file:$(pwd)\",\"enable\":true}"
```

Open `http://127.0.0.1:3100/<company-prefix>/research-chat` to use.

## Architecture

- `src/manifest.ts` — Paperclip plugin manifest, declares one page slot
  (`research-chat`) and one sidebar link.
- `src/worker.ts` — Node worker. Wraps Paperclip REST API for
  `bootstrap`, `chat` (read), and `sendMessage` (write + wake).
- `src/ui/index.tsx` — React. Slack-style chat layout with bubble
  alignment per author, live "PI is thinking" pulse, model badge.
- `tests/plugin.spec.ts` — vitest, mocks Paperclip API.

## Why this exists (not just commenting on an issue from /issues)

Issue threads are designed for task discussion, not high-bandwidth
co-authoring. This plugin gives a focused surface that:

- always wakes PI on send (no need to remember `/wakeup`)
- shows live "thinking" state to mimic real chat
- separates the discussion thread from production research issues
- can be hidden / disabled per company without affecting the issue
  system
