---
name: DL Research
description: Multi-agent autonomous research company for experiment execution and paper production
slug: dl-research
schema: agentcompanies/v1
version: 0.1.0
license: MIT
authors:
  - name: mz
goals:
  - Build a repeatable autonomous research loop from idea to paper
  - Run rigorous experiments with reproducible evidence and claim audits
  - Produce submission-ready paper artifacts and presentation assets
requirements:
  secrets:
    - ANTHROPIC_API_KEY
    - OPENAI_API_KEY
    - GH_TOKEN
---

DL Research is a Paperclip-based autonomous research organization.

The company runs a closed loop:

1. identify research opportunities and prior art
2. design and execute experiments
3. verify evidence quality and claim validity
4. draft and refine paper artifacts
5. iterate using critique and governance checkpoints

All work is company-scoped, tracked through issues/comments, and managed through heartbeat- and routine-based execution.
