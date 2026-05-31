---
name: pika-meeting-bridge
description: |
  Optional meeting participation bridge inspired by Pika Skills:
  join external research meetings, capture notes, and feed decisions
  back into Paperclip issues and vault summaries.
metadata:
  classification: writing
  sources:
    - kind: github-repo
      repo: Pika-Labs/Pika-Skills
      url: https://github.com/Pika-Labs/Pika-Skills
      usage: referenced
---

# pika-meeting-bridge

Use this skill only when explicitly asked to join/summarize an external meeting (e.g., Google Meet).

## Preconditions

- `PIKA_DEV_KEY` is configured.
- Meeting participation is approved by the operator.
- The meeting has clear objective and expected output.

## Workflow

1. Validate meeting objective and scope.
2. Join meeting with configured identity.
3. Capture:
   - decisions
   - open questions
   - action items (owner + due window)
4. Post structured summary to the relevant issue.
5. Persist long-lived knowledge to vault note.

## Safety and governance

- Never join meetings without explicit operator instruction.
- Do not expose secrets or internal data in external calls.
- Mark uncertain transcriptions as tentative.

## Output schema

```markdown
### Meeting summary
- context:
- key decisions:
- unresolved questions:
- action items:
  - [owner] task (due)
- follow-up issue links:
```

