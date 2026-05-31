---
name: exp-checker
description: Validate experiment quality before claim writing
metadata:
  sources:
    - kind: github-file
      repo: wanshuiyin/Auto-claude-code-research-in-sleep
      path: skills/skills-codex/experiment-audit/SKILL.md
      commit: f14037831b21469e66bd8bed5f9ce5f5a8f8c1f9
      attribution: wanshuiyin
      license: MIT
      usage: vendored
---

# exp-checker

Perform pre-claim checks:

- run completeness and missing-cell detection
- suspicious metric inflation checks
- baseline parity checks
- reproducibility checklist
