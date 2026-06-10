# DLR Docs and Assets Audit (2026-06-10)

## Scope

- README/link integrity after visualization asset slimming
- `doc/plans/` custom plan inventory
- `companies/dl-research/tasks/ari-8..15` status annotation
- workspace-level non-repo assets placement policy

## Findings

1. Visualization binaries are now intentionally untracked and regenerated
   locally from `doc/visualizations/*.html` sources.
2. README and `doc/DEMO_VIDEO_PLAYBOOK.md` references were updated to source and
   generation-first guidance.
3. `doc/plans/2026-05-05-autosota-inspired-dynamic-topology.md` is preserved as
   an active strategy draft (not marked complete).
4. `ari-8..15` task files now include explicit frontmatter fields:
   - `status: todo`
   - `lastReviewedOn: 2026-06-10`
5. Large demo media was moved outside the repo to:
   - `/Users/mz/Desktop/研究自動化Multi-agent/assets/`

## Ongoing Policy

- Keep generated media artifacts out of git by default.
- Keep reproducible generation scripts and source HTML in git.
- Update task frontmatter status fields whenever review cadence changes.
