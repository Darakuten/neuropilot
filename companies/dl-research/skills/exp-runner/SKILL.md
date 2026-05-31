---
name: exp-runner
description: Execute experiment batches and capture reproducible artifacts
metadata:
  sources:
    - kind: github-file
      repo: wanshuiyin/Auto-claude-code-research-in-sleep
      path: skills/skills-codex/run-experiment/SKILL.md
      commit: f14037831b21469e66bd8bed5f9ce5f5a8f8c1f9
      attribution: wanshuiyin
      license: MIT
      usage: vendored
---

# exp-runner

Run planned experiments and always log:

- exact command
- seed and config
- environment/runtime snapshot
- output artifact path
- failure reason and retry decision
