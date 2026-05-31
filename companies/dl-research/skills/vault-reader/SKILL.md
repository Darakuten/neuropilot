---
name: vault-reader
description: |
  Read, search, and append to the DL Research Obsidian vault. Use whenever
  you need company-private context, prior thinking, raw notes, captured
  literature, drafts, or to write back consolidated insights. Always read
  before proposing a research direction; this is the company's long-term
  memory.
metadata:
  classification: company-private
  vault_root: "/Users/mz/研究自動化Multi-agent/paperclip/Obsidian Vault"
  schema: "PARA + dated daily notes"
---

# vault-reader

The DL Research Obsidian vault is the canonical store of company knowledge:
prior research notes, captured papers, internal frameworks, and the human
operator's thinking. **Treat it as the single most important context source
before any external web search.**

## Vault location

`/Users/mz/研究自動化Multi-agent/paperclip/Obsidian Vault`

The path contains a non-ASCII character; quote it in shell.

## Folder layout (PARA + extensions)

| Folder | What lives there | When to read |
|---|---|---|
| `0_Inbox/` | Unprocessed captures | First — fresh ideas may relate to your task. |
| `1_Daily/` | YYYY-MM-DD daily notes | When the user references "what I was thinking last week". |
| `2_Sources/` | Reference material, papers, articles | When you need prior literature the user has already vetted. |
| `3_Knowledge/` | Refined notes, frameworks, schemas | Primary research-relevant zone. Read before novel ideation. |
| `4_Projects/` | Active projects with deliverables | Check overlap with current Paperclip projects. |
| `5_Areas/` | Long-term responsibilities (Business, Operations, Relationships, etc.) | Read for organizational context. |
| `7_Archive/` | Completed/cold material | Only when explicitly searching for closed-out work. |
| `MOC/` | Maps of Content (index notes) | Start here for unfamiliar topics. |
| `Templates/` | Note templates | Use these when writing new notes back. |
| `Attachments/` | Images, PDFs | Reference when a note links to an image. |

## Read workflow

1. **Start with `MOC/`** for any unfamiliar topic — it usually links to the
   3–10 most relevant notes.
2. **Grep before list**: `rg -l "<query>" "/Users/mz/研究自動化Multi-agent/paperclip/Obsidian Vault" --type md` returns matching files fast. Limit to PARA folders to skip Templates/Attachments.
3. **Follow `[[wiki-links]]`** in matched notes — Obsidian links are the
   knowledge graph; one match usually exposes a cluster.
4. **Check `1_Daily/<recent-week>/`** if the user mentions a recent
   conversation — daily notes are the running diary.
5. **Always cite the path** in your output: `(vault: 3_Knowledge/foo.md)`.

## Write-back workflow

When you produce consolidated insights worth keeping:

1. **Default destination** is `0_Inbox/<YYYY-MM-DD>-<slug>.md`. The user
   processes Inbox into PARA later.
2. **Use the Inbox template** if `Templates/inbox.md` exists; otherwise:

   ```markdown
   ---
   created: YYYY-MM-DD
   source: paperclip-agent/<role>
   tags: [research, <topic>]
   ---

   # <Title>

   ## Summary
   ...

   ## Key references
   - [[wiki-link or path]]

   ## Open questions
   - ...
   ```

3. **Never silently edit existing notes**. Append to the bottom under
   `## Updates by paperclip-<role> <date>` or create a sibling note that
   links via `[[]]` instead.
4. **Avoid Templates/, MOC/, 7_Archive/** for writes; those are
   curated by the human.

## Caveats

- The vault is git-tracked (`.git/` exists in vault root). Don't `git
  commit` unless the human explicitly asks.
- Some files are large (e.g. `context-graph.html` is ~150KB). Use
  `head -100` or grep for content rather than reading the whole file when
  scanning.
- Daily notes can be very dense; scan headings first.
- Files are UTF-8 with Japanese content; preserve encoding.
