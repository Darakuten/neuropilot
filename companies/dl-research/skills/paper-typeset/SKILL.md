---
name: paper-typeset
description: |
  Convert the latest Markdown paper draft into arXiv-style HTML, a Letter-size
  PDF (rendered via headless Chrome), and a single-file LaTeX source. Use as
  the final pipeline step of every research theme, after Writer has produced
  `paper/sections/full_draft_v1.md` (or a later versioned draft) and Critic
  has cleared the claim audit. The skill is idempotent — re-run it whenever
  the draft changes.
metadata:
  classification: publication
  pairs_with: [paper-write, paper-write-matsuo, paper-claim-audit]
---

# paper-typeset

Wraps `scripts/build_paper.py` so that any agent (typically Writer) can
emit a publication-ready bundle from the project workspace.

## Pre-conditions

1. The active issue is the `[Publish]` step (or you were explicitly asked to
   typeset a draft).
2. `paper/sections/<draft>.md` exists in the project workspace
   (`PAPERCLIP_PROJECT_WORKSPACE_PATH`).
3. Result figures (`results/figures/*.png`) referenced by the draft are
   present. If figures are missing, list the missing files in your
   issue comment and stop — do **not** typeset against stale assets.

## Workflow

1. **Locate the workspace.** `cd "$PAPERCLIP_PROJECT_WORKSPACE_PATH"`.
2. **Bootstrap the build script.** Copy `build_paper.py` from this skill's
   directory into the project workspace `scripts/` folder if it is not
   already there. Use `cp -n` (no clobber) so a project-customised copy
   is preserved. The script source is bundled next to this `SKILL.md` as
   `build_paper.py`.
3. **Pick the draft.** Default: `paper/sections/full_draft_v1.md`. If the
   project uses a different filename (e.g. `full_draft_v2.md`), pass it via
   the `PAPER_DRAFT` env var; the build script resolves
   `paper/sections/$PAPER_DRAFT` relative to the workspace root when set,
   otherwise it falls back to the default.
4. **Run the build.**
   ```bash
   python3 scripts/build_paper.py
   ```
   The script writes:
   - `paper/dist/main.html`  — arXiv-like preview
   - `paper/dist/main.pdf`   — Letter PDF (via headless Chrome)
   - `paper/dist/main.tex`   — single-file LaTeX
   - `paper/dist/figures/*`  — copied figure assets
   - `paper/dist/build_summary.json` — paths + title metadata
5. **Verify outputs.** All four artefacts (html, pdf, tex, build_summary)
   must exist and be non-empty. The PDF must be ≥ 50 KB; smaller almost
   always means Chrome failed silently.
6. **Post the artefact summary** as an issue comment using the
   `paperclip` skill. Include:
   - Title of the typeset paper.
   - Absolute paths of `main.html`, `main.pdf`, `main.tex`.
   - SHA-256 of the PDF (use `shasum -a 256`).
   - Number of pages in the PDF (parse from `file main.pdf`).
   Then mark the publish issue `done` and link the artefacts on the
   parent theme issue.

## Failure handling

- **Chrome not found.** macOS path is `/Applications/Google Chrome.app`.
  If absent, log a `dependency missing` line in the issue comment and
  leave the issue in `in_review` for operator escalation. Do NOT fall
  back to a non-arXiv-styled PDF — operator must decide.
- **Markdown parse errors.** The script prints the offending line; copy
  it into the issue comment and request Writer to amend the draft.
- **Missing figures.** List the missing PNG paths and request a re-run of
  Experimenter / Engineer to regenerate them.
- **Repeat invocations.** The script is idempotent. Re-running over an
  existing `paper/dist/` overwrites in place (keeps the same filenames so
  links survive).

## Conventions

- Always commit to the `_default` workspace under the project. Do not
  scatter outputs across other workspaces.
- Do not edit `paper/dist/main.html` by hand — re-run the script after
  editing the Markdown source instead. Hand edits will be lost on next
  build.
- LaTeX source is meant to be Overleaf-pasteable. It uses only standard
  CTAN packages (`booktabs`, `graphicx`, `caption`, `microtype`,
  `hyperref`, `enumitem`, `titlesec`, `lmodern`).
