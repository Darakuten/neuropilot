---
name: paper-write-matsuo
description: |
  Paper-writing quality gate inspired by Yutaka Matsuo's guidance:
  make contribution explicit, reconstruct for community context,
  and maximize reviewer readability and reproducibility.
metadata:
  classification: research-core
  sources:
    - kind: web-article
      url: https://ymatsuo.com/information/how-to-write-paper-en/
      attribution: Yutaka Matsuo
      usage: referenced
---

# paper-write-matsuo

Use this skill when drafting or revising paper sections, especially for:

- introduction contribution framing
- related work positioning
- figure/table readability
- reproducibility and reviewer clarity

## Core principles

1. **Contribution-first framing**
   - End introduction with 2-3 explicit contribution bullets.
   - Each bullet must state who can reuse this result and why the community benefits.

2. **Community reconstruction, not local self-contained storytelling**
   - Rewrite claims in the target community vocabulary.
   - Position as extension/complement/alternative to prior work, not casual rejection.

3. **Shared-problem narrative**
   - Prefer: shared problem -> method -> evaluation -> complete related work -> insight.
   - Avoid: private insight jump -> method -> isolated evaluation.

4. **Figure/table first readability**
   - A reviewer should grasp the paper from figures/tables and captions alone.
   - Check print readability; improve labels/legend/units until unambiguous.

5. **Reproducibility anchor**
   - Include at least one algorithm/protocol block that allows full replication.
   - State dataset split, metric definition, and hardware/runtime assumptions explicitly.

## Writing checklist for each major section

### Introduction

- Problem importance in 2-4 sentences
- Prior baseline and gap
- Proposed approach in one sentence
- 2-3 contribution bullets (with concrete value)

### Related Work

- Group prior work by mechanism or assumption
- Explain relation to this work (extension/complement/alternative)
- Avoid strawman dismissal

### Results

- Start with main claim sentence
- Report whether result is good/bad before details
- Add scale cues reviewers can immediately understand (e.g., N, dataset size, compute)

### Limitations

- List failure modes and boundary conditions
- Distinguish what is unresolved vs future work

## Output contract

When asked to draft text, return:

1. section draft
2. inline TODO markers for missing evidence (`[EVIDENCE NEEDED]`)
3. a short "reviewer-friction" list (3-5 bullets)

