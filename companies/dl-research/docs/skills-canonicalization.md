# Skills Canonicalization

## Policy

- Canonical source of DL Research skills:
  - `companies/dl-research/skills/*`
- Runtime copies must not diverge from repository canonical content.

## Runtime handling

- Cursor runtime (`~/.cursor/skills`) is synchronized from canonical via:
  - `scripts/sync-dlr-skills-runtime.sh`
- The script archives stale hashed duplicates (`<skill>--*`) into
  `~/.cursor/skills-backup-<timestamp>` and creates symlinks with canonical names.
- Verification target after sync:
  - All canonical skills present as symlinks in `~/.cursor/skills`
  - No remaining hashed duplicates for canonical skill names

## Claude runtime note

- `~/.claude/skills` in this environment is managed via Paperclip runtime links
  (`~/.paperclip/instances/...`), so no direct duplicate cleanup was required for
  the DL Research canonical set.
- Continue to treat repository canonical files as source of truth.

## Slimming actions applied

- Removed vendored font license text bundle:
  - `companies/dl-research/skills/canvas-design/canvas-fonts/*`
- Removed vendored MCP reference markdown bundle:
  - `companies/dl-research/skills/mcp-builder/reference/*`
- Removed oversized vendored OOXML guide:
  - `companies/dl-research/skills/docx/ooxml.md`

The corresponding skill docs were updated to fetch upstream references on-demand.
