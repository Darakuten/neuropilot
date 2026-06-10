# Fork Notes (NeuroPilot)

## Remotes

- Upstream fork source: `origin` -> `https://github.com/paperclipai/paperclip.git`
- Product fork remote: `pi-origin` -> `https://github.com/Darakuten/neuropilot.git`

Observed default branches:

- `origin`: `master`
- `pi-origin`: `main`

## Baseline and divergence

- Local fork baseline for this cleanup: `685ee84e`
- Current refactoring branch: `refactor/cleanup-2026-06`
- Baseline tag: `refactor-baseline`
- Divergence from baseline (current branch): 16 commits, `14576 insertions(+), 426 deletions(-)`

## Upstream tracking strategy

1. Keep **upstream core** (`server/`, `ui/`, `packages/`) as close as possible
   to `origin/master`.
2. Isolate customizations in:
   - `companies/dl-research/**`
   - plugin examples under `packages/plugins/examples/dl-research-*`
   - focused docs under `doc/plans/` and DLR-specific notes.
3. Prefer regular sync cadence:
   - fetch `origin`
   - merge/rebase `origin/master` into a staging branch
   - resolve conflicts with “upstream-first” policy for core files.
4. Keep heavy/generated assets out of git and regenerate from scripts.
5. Before pushing to `pi-origin/main`, run:
   - `pnpm -r typecheck`
   - `pnpm build`
   - `pnpm test` (allowing known unrelated flaky test failures to be triaged explicitly).

## Known verification caveat

On this machine, full `pnpm test` currently reports an intermittent timeout in:

- `packages/adapter-utils/src/ssh-fixture.test.ts`
- test case: `round-trips a git workspace through the SSH fixture`

This failure is outside the DLR refactoring scope and should be tracked as a
separate reliability item.
