# Vault Index Regeneration

This document defines how to refresh the knowledge-graph artifacts used by the
DL Research Obsidian vault integration.

## Scope

- Vault root: `/Users/mz/Desktop/研究自動化Multi-agent/paperclip/Obsidian Vault`
- Artifacts:
  - `Obsidian Vault/vault-index.json`
  - `Obsidian Vault/context-graph.json`

These files are consumed as fast lookup snapshots by the research workflow.

## Current Source of Truth

The repository currently stores the generated snapshots (`vault-index.json` and
`context-graph.json`) but does not include a deterministic in-repo generator
script for them.

Regeneration is therefore performed from the Obsidian workflow side, then
committed back into the repository.

## Regeneration Procedure

1. Open the vault in Obsidian at:
   - `/Users/mz/Desktop/研究自動化Multi-agent/paperclip/Obsidian Vault`
2. Run the vault indexing/export routine used in your Obsidian setup (the same
   routine that writes `vault-index.json` and `context-graph.json`).
3. Verify both files changed:
   - `Obsidian Vault/vault-index.json`
   - `Obsidian Vault/context-graph.json`
4. Validate parseability before commit:

```bash
python -m json.tool "Obsidian Vault/vault-index.json" >/dev/null
python -m json.tool "Obsidian Vault/context-graph.json" >/dev/null
```

5. Sanity-check record counts:

```bash
python - <<'PY'
import json
from pathlib import Path
base = Path("Obsidian Vault")
idx = json.loads((base / "vault-index.json").read_text(encoding="utf-8"))
graph = json.loads((base / "context-graph.json").read_text(encoding="utf-8"))
print("notes:", len(idx.get("notes", [])))
print("graph_nodes:", len(graph.get("nodes", [])))
print("graph_edges:", len(graph.get("edges", [])))
PY
```

6. Spot-check one neuroscience/ML note entry in `vault-index.json` and one link
   edge in `context-graph.json`.

## Operational Notes

- `Obsidian Vault/` is ignored in git for bulk note churn; commit only the
  exported index snapshots intentionally.
- Keep UTF-8 encoding as-is; do not normalize filenames during export.
- If the indexing routine location changes, update this document and
  `companies/dl-research/skills/vault-reader/SKILL.md` together.
