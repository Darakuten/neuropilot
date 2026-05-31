---
name: research-discussion
description: |
  Structured back-and-forth dialogue with the human operator (board) to
  refine a vague research direction into a falsifiable hypothesis with
  success criteria, scoped within compute and time budget. Use when the
  user opens a research-theme discussion, when an issue has continuationPolicy=wake_assignee
  and the user's last comment asks an open question, or when the user
  explicitly asks PI to "think with them".
metadata:
  classification: governance
  pairs_with: [vault-reader, web-research, paperclip]
---

# research-discussion

This is **PI's primary collaboration loop with the human operator**. Treat
it as a high-bandwidth Socratic dialogue, not a status report.

## Hard rules (chat-mode invariants — read first, every wake)

These rules apply whenever **any** of these conditions is true:

- The assigned issue is the canonical Research Chat thread
  (title `Research hypothesis discussion (PI ↔ Operator)`).
- The assigned issue title starts with `[Discussion]`, `[Discuss-Paper]`,
  or any other `[Discuss-…]` prefix (operator-driven long-running review
  threads where you reply on operator comments only).
- The assigned issue is under the `Research Discussion` project.

The server (`server/src/services/discussion-issue.ts`) and the recovery
loop (`server/src/services/recovery/service.ts`) recognise the same
title patterns and will not re-wake you with `issue_continuation_needed`
or spawn `Recover stalled issue …` issues for these threads — but you
must still honour the rules below in case a stale wake races through.

### Rule 0 — Decide based on `PAPERCLIP_WAKE_REASON`, not comment-scanning

This is the **first decision** of every chat-mode heartbeat. Read the env var
`PAPERCLIP_WAKE_REASON` (set by the heartbeat runner).

| `PAPERCLIP_WAKE_REASON` matches… | Action |
|---|---|
| `manual` / `on_demand` / `user_comment` / `external_comment` | **Reply to the operator.** Proceed to Turns 1..N. |
| `issue_commented` / `issue_reopened_via_comment` | **Reply to the operator** — these fire automatically when the operator (or any non-self actor) posts a comment on this assigned `in_progress` issue. They are the normal "operator just sent a chat message" wake. |
| `crystallize_hypothesis` (`triggerDetail`) | **Run the crystallization flow** — operator pressed the "Crystallize" button. Decide whether the hypothesis is ready and either emit a `hypothesis-proposal` block OR explain in 1–3 short paragraphs which quality-bar items are still open. |
| `issue_continuation_needed` | **Exit immediately. POST NO COMMENT.** Just terminate. |
| `issue.productive_terminal_continuation_recovery` | **Exit immediately. POST NO COMMENT.** |
| `issue_assignment_recovery` | **Exit immediately. POST NO COMMENT.** |
| any other system-sourced wake | **Exit immediately. POST NO COMMENT.** |

**Sanity check on top of Rule 0:** even on a "reply" wake, look at the literal
latest comment. If it is **your own** comment (`authorAgentId === your agent
id`, OR `createdByRunId` set on a comment that matches your recent run),
the wake is most likely a stale recovery race — exit silently. The
`PAPERCLIP_WAKE_REASON` table is your primary signal; the latest-comment
check is the safety net.

This is **not negotiable**. The chat plugin auto-pauses you between turns
specifically to short-circuit Paperclip's recovery loop; if a stale recovery
wake still races through, your job is to drop it on the floor without leaving
any trace in the chat. Posting a "サイレント終了" / "no new comment" /
"自分の前回返信の再トリガー" comment is **a bug** — that comment itself
re-triggers the loop because Paperclip's recovery service treats your
post as "productive activity" and queues another wake.

### Rule 1 — Reply only, never report

Forbidden output patterns when you DO reply (manual wake):

- `Governance summary:`, `**トリガー:**`, `**判断:**`, `**ステータス:**`,
  `**次のアクション:**`
- `ウェイク`, `wake`, `heartbeat` mentions
- run-id mentions like `run dc30fe35`
- comment-id mentions like `comment f2b8a4d8`
- meta-discussion of your own prior posts ("前回の返信は…", "再トリガーされた…")

The operator wants a chat reply. Not an audit log. Not a status report.
Not a self-reflection on the heartbeat lifecycle.

### Rule 2 — Silent exit means SILENT

When Rule 0 says "exit immediately, post no comment", the literal expected
behavior is: your process terminates with **zero** `POST /api/issues/…/comments`
calls. The chat must show no new bubble after a stale recovery wake.

**These are all forbidden** — every one of them is a comment that defeats
"silent exit":

- `サイレント終了` / `Silently exiting` / `No new operator comments`
- `即時終了` / `Immediately terminating` / `Exiting per Rule 0`
- `issue_continuation_needed — システムウェイク、即時終了。`
- `自分の前回返信の再トリガー` / `Stale wake detected`
- `認証エラー` / `PAPERCLIP_API_KEY 未設定` / `local-board として記録`
- ANY one-liner that mentions `PAPERCLIP_WAKE_REASON`, `recovery`, `wake`,
  `heartbeat`, `run id`, or `comment id`.

The right action when Rule 0 says exit: literally do nothing. Return from
the loop. Exit the process. The chat plugin and its UI know how to handle a
heartbeat run that produced zero side effects — that's the *expected*
outcome of a stale recovery wake. A meta-comment explaining the silent exit
is itself the bug.

If you absolutely cannot resist explaining yourself, do it in your run log
output (stderr / `console.warn`), not in a chat comment.

### Rule 3 — Never change this issue's status

Forbidden actions on this issue:
- PATCH status to `done`, `cancelled`, `blocked`, `in_review`
- Create `[Recovery]` or `[Continuation]` child issues
- Reassign to another agent

The operator owns the lifecycle of the chat thread. If something looks
broken (auth, wake-loop, etc.), say it ONCE in plain conversational text
on a manual-wake reply, then stop. Do NOT take corrective governance action.

### Rule 4 — Never delegate from this issue (with one operator-authorized escape hatch)

No `paperclip` skill calls that create child issues, projects, or wake
other agents while you're inside the discussion thread. The only exception
is the `hypothesis-proposal` text emission (see "Final turn — Crystallize"),
which is markdown the chat UI parses, not an API call.

**Operator-authorized delegation (paper-review threads only)**

In `[Discuss-Paper]` review threads, the operator may explicitly ask you
to spawn a follow-up task ("rerun the pipeline as a separate task — お願いします").
In that case you may create exactly **one** child issue, but only if all of
the following hold:

1. The operator's last comment contains an explicit authorization phrase
   ("お願いします", "go ahead", "create the task", "spawn it", …).
2. The created issue body MUST include both `parentId` (the theme issue
   id, e.g. `DLR-49`) and `assigneeAgentId` resolved from
   `/api/companies/:companyId/agents` by role (`Engineer`,
   `Experimenter`, etc.). An unassigned child is a defect — that issue
   will sit in `todo` forever and the pipeline will silently stall.
3. The confirmation comment you post back on the discussion thread MUST
   include the new identifier (e.g. `DLR-114 created and assigned to
   Engineer`) AND end with `<!--research-chat-no-wake-->` so the
   confirmation does not re-wake you.
4. Do not chain further delegations in the same heartbeat. Wait for the
   next operator comment before any further work.

### Rule 5 — Auth-header guard

If you notice your previous comment was attributed to `local-board` instead
of you, that means your `curl` forgot the `Authorization: Bearer
$PAPERCLIP_API_KEY` header. Fix the header before posting your next reply.
Do NOT spawn recovery work, do NOT close the issue, do NOT post a
meta-comment about the auth issue.

## Goal of one session

Take a vague seed (a sentence, a paper, a frustration, a question) and
finish with:

1. A **falsifiable hypothesis** ("If we do X, then we expect Y, because Z")
2. **Success criteria** ("we'll consider the hypothesis supported if metric M
   crosses threshold T on benchmark B with ≥3 seeds")
3. **Scope** (≤ time budget, ≤ compute budget, must use existing data)
4. **First experiment** sketched as an issue with assignee, deliverable,
   evidence-of-progress definition.

## Loop structure

Each turn = one PI heartbeat. Reply length: **short** (≤ 6 short paragraphs).
Long answers kill the conversational rhythm.

### Turn 1 — Acknowledge and ground

- One-line restatement of what you heard.
- One reference from the **vault** (use `vault-reader`) showing prior
  thinking the user has already done.
- 1–3 **closest prior works** from web (use `web-research`) — title,
  year, one-line delta.
- One concrete question that, when answered, resolves the biggest
  ambiguity. (Don't fire 5 questions; fire 1 sharp one.)

### Turn 2..N — Iteratively narrow

- Each turn answers the previous user message AND advances the hypothesis
  toward the four-item goal above.
- After every 2 turns, **summarize the current best hypothesis as a
  diff** ("vs last turn: tightened scope to small-scale only; added
  baseline X").
- Do NOT propose experiments until success criteria are agreed.

### Final turn — Crystallize

When the hypothesis meets the quality bar (see below), and (a) the operator
explicitly asks for crystallization, OR (b) you've judged the loop has
converged, emit ONE comment that:

1. Opens with a 2–3 sentence rationale of *why* this is ready (which checks
   in the quality bar are now satisfied).
2. Then includes a fenced code block tagged `hypothesis-proposal`
   containing the JSON schema below.
3. Stops there. **Do NOT delegate, do NOT create issues directly, do NOT
   wake other agents.** The chat UI will surface a "Approve & launch"
   button that calls the `promoteTheme` action; the operator owns the
   commit point.

#### Required emit format

````
~~~hypothesis-proposal
{
  "version": 1,
  "title": "[Theme] <slug ≤ 60 chars>",
  "summary": "<one paragraph, ≤ 4 sentences>",
  "hypothesis": "If we do <X>, then we expect <Y>, because <Z>",
  "successCriteria": [
    "<falsifiable statement with metric, threshold, dataset, seeds>"
  ],
  "scope": {
    "timeBudget": "<e.g. '2 weeks wall clock'>",
    "computeBudget": "<e.g. '120 A100-hours'>",
    "constraints": ["<must use existing data X>", "<no closed-source models>"]
  },
  "differentiatedFrom": [
    {"title": "<paper title>", "year": "YYYY", "venue": "<arxiv/conf>", "delta": "<one sentence: how we differ>"}
  ],
  "proposedProject": {
    "mode": "create-new",
    "name": "<project name, e.g. 'NeurIPS 2027 - <slug>'>",
    "color": "#3a86ff",
    "targetDate": "YYYY-MM-DD"
  },
  "childIssues": [
    {
      "role": "Ideator",
      "title": "[Idea] <one-line task>",
      "priority": "high",
      "deliverable": "<what 'done' looks like>",
      "dependsOn": []
    },
    {
      "role": "Lit Scout",
      "title": "[Lit] <one-line task>",
      "priority": "high",
      "deliverable": "...",
      "dependsOn": []
    },
    {
      "role": "Experimenter",
      "title": "[E-baselines] <one-line task>",
      "priority": "high",
      "deliverable": "...",
      "dependsOn": ["Lit Scout"]
    },
    {
      "role": "Critic",
      "title": "[Audit] <one-line task>",
      "priority": "medium",
      "deliverable": "...",
      "dependsOn": ["Experimenter"]
    },
    {
      "role": "Writer",
      "title": "[Write] <one-line task>",
      "priority": "medium",
      "deliverable": "...",
      "dependsOn": ["Experimenter", "Critic"]
    },
    {
      "role": "Writer",
      "title": "[Publish] Typeset paper artifacts (HTML/PDF/LaTeX)",
      "priority": "medium",
      "deliverable": "paper/dist/main.{html,pdf,tex} produced via the paper-typeset skill",
      "dependsOn": ["Writer"]
    }
  ]
}
~~~
````

Field rules:

- `proposedProject.mode` is either `create-new` (creates a fresh project)
  or `existing` (then add `"projectId": "<uuid>"`).
- `childIssues[].role` MUST be one of the company's agent role names:
  `Ideator`, `Lit Scout`, `Experimenter`, `Critic`, `Writer`, `Mentor`,
  `Engineer`, `Worker`. (Use the exact spelling — the worker maps role →
  assignee agent ID by name lookup.)
- `childIssues[].dependsOn` references other child `role` values; the
  worker turns these into `blockedBy` issue links so each agent only
  starts when its prerequisites are done.
- Title prefix conventions are not optional — they signal the lifecycle
  stage to the rest of the system: `[Idea]`, `[Lit]`, `[E-...]`,
  `[Audit]`, `[Write]`, `[Publish]`, `[Ablations]`.
- **Always include a final `[Publish]` step** assigned to Writer, depending
  on `Writer` (the `[Write]` issue). The publish step uses the
  `paper-typeset` skill to emit `paper/dist/main.{html,pdf,tex}`. If you
  forget it, `promoteTheme` will append it automatically — but list it
  yourself so the operator can preview the full pipeline before approval.
- Keep child issue counts ≤ 9. Anything more belongs in a Phase 2 epic
  the relevant agent will spawn from inside its own loop.
- The JSON MUST parse — no comments, no trailing commas. Validate
  before posting.

#### After the proposal

- The chat UI shows a "Proposal" card with three actions:
  - **Refine more** — operator types feedback; you continue the dialogue
    and may emit a new (versioned) `hypothesis-proposal` block later.
  - **Edit & approve** — operator tweaks fields inline (title, scope,
    child issues), then approves.
  - **Approve & launch** — the worker creates the project + theme issue
    + child pipeline + relations, then the operator is redirected.
- **You stay paused** until the operator presses Approve. Do NOT continue
  spawning related work in parallel.
- After approval, the worker archives the discussion thread to
  `0_Inbox/<YYYY-MM-DD>-hypothesis-<slug>.md` in the vault. You don't
  need to do this manually if you're sure the worker ran (the operator
  will see a "vault snapshot saved" line in the result card).

#### Safe posting rule for multiline proposal comments

When you POST the crystallization comment to Paperclip, **do not** use a
heredoc nested inside `curl -d "$(cat <<'PAYLOAD' ...)"`. That pattern can
truncate stored comment bodies, which leaves the chat UI with a broken
`hypothesis-proposal` block where only the first JSON line survives.

Use this safe pattern instead by default:

```bash
curl -sS -X POST \
  "$PAPERCLIP_API_URL/api/issues/$PAPERCLIP_TASK_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'PAYLOAD'
{"body":"<your rationale + fenced hypothesis-proposal block>"}
PAYLOAD
```

A repo helper script may exist in some dev workspaces, but do **not** assume it
is available inside your runtime workspace.

## Core moves

| Situation | What to do |
|---|---|
| User offers a broad goal | Restate as 2 narrower problems and ask which one matters more right now. |
| User contradicts a literature claim | Pull the citation. If user is right, update internal model and say so. If literature is right, walk through the evidence. |
| Idea overlaps a vault note | Cite the note path. Ask whether to extend or rebuild. |
| Idea overlaps a paper | Quote the paper's contribution. Ask what new angle we'd add. |
| Idea is novel but ungrounded | List 2–3 nearest analogous lines of work, say "we'd be in this neighborhood — is that intentional?" |
| User says "do whatever you think" | Propose 2 contrasting paths with explicit trade-offs (cost, novelty, reproducibility). Make them choose. |
| User stuck in detail rabbit hole | Pull back: "before we go deeper, the bigger choice still open is X". |
| Compute/time budget unclear | Always ask: hours of A100? days of wall clock? human review hours per week? |

## Hypothesis quality bar

A hypothesis is ready when **all** are true:

- [ ] **Falsifiable**: there is at least one experiment outcome that
      would refute it.
- [ ] **Specific**: replace "improves performance" with "ROUGE-L on
      XSum increases by ≥1.5 vs baseline B".
- [ ] **Scoped**: fits in the budget the user named.
- [ ] **Differentiated**: at least one prior work was named that we
      explicitly diverge from.
- [ ] **Reviewable**: a competent peer in the field would understand
      the claim from one paragraph.

## Anti-patterns

- ❌ **Long monologue answers.** Kills the loop. Keep it conversational.
- ❌ **Suggesting experiments before criteria.** That hides scope creep.
- ❌ **Citing sources you didn't actually fetch.** Never invent papers.
- ❌ **Premature delegation.** Do not wake Ideator/Lit Scout in the
  middle of discussion; that fragments context.
- ❌ **Skipping vault check.** Almost always there's a relevant
  pre-existing note; missing it embarrasses the system.

## Persisting the conversation

Every meaningful turn the user takes should leave traces:

1. **Issue comment** with your reply (Paperclip persists this).
2. **Hypothesis revision counter** in the issue body's plan document
   (`PATCH /api/issues/{id}` with body update).
3. On final acceptance, **archive a snapshot** to vault:
   `0_Inbox/<YYYY-MM-DD>-hypothesis-<slug>.md` with the full thread.
