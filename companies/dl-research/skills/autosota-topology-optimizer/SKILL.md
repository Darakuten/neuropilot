---
name: autosota-topology-optimizer
description: |
  Dynamic multi-agent topology optimization inspired by AutoSOTA's staged
  specialization (preparation, evaluation, reflection) while preserving
  Paperclip governance and company constraints.
metadata:
  classification: governance
  sources:
    - kind: paper
      title: AutoSOTA: An End-to-End Automated Research System for State-of-the-Art AI Model Discovery
      url: https://arxiv.org/abs/2604.05550
      usage: referenced
---

# autosota-topology-optimizer

Use this skill when planning or revising agent structure per theme/domain.

## Design intent

AutoSOTA shows strong separation of duties across:

- resource preparation
- experiment evaluation/repair
- reflection + ideation + supervision

This skill adapts that decomposition into Paperclip without hardcoding one static org.

## Dynamic topology policy

For each new theme issue, compute a **theme profile**:

- domain: `llm` | `nlp` | `cv` | `timeseries` | `systems` | `other`
- evidence scarcity: `low` | `medium` | `high`
- infra volatility: `low` | `medium` | `high`
- run horizon: `short` | `long`
- novelty target: `incremental` | `architectural`

Then apply this role-weight policy:

- High evidence scarcity -> weight `lit-scout` + `prior-art-search` + `citation-audit`
- High infra volatility/long horizon -> weight `engineer` + `exp-runner` + repair loops
- Architectural novelty target -> weight `ideator` + `mentor` + `critic`
- Publication-near phase -> weight `writer` + `paper-write-matsuo` + audits

## Execution mechanism

1. PI writes a topology note in the parent theme issue:
   - selected weighted roles
   - disabled/paused roles for this theme
   - max concurrent runs by role
2. Spawn child issues only for selected roles.
3. On each milestone completion, re-score and optionally reshape:
   - add/remove child tracks
   - change assignee role
   - tighten or relax concurrency caps

## Guardrails

- Never exceed company budget or run-concurrency caps.
- Never bypass approval gates for governed transitions.
- Require `critic` validation before accepting major SOTA claims.
- Require provenance comments for any auto-reshape action.

## Output contract

Return a `topology-plan` block:

```json
{
  "themeProfile": {
    "domain": "timeseries",
    "evidenceScarcity": "medium",
    "infraVolatility": "high",
    "runHorizon": "long",
    "noveltyTarget": "architectural"
  },
  "roleWeights": [
    { "role": "lit-scout", "weight": 0.75 },
    { "role": "engineer", "weight": 0.9 },
    { "role": "ideator", "weight": 0.7 },
    { "role": "critic", "weight": 0.8 }
  ],
  "maxConcurrentRunsByRole": {
    "pi": 1,
    "engineer": 2,
    "experimenter": 2
  },
  "reshapeTrigger": "after_baseline_reproduction"
}
```

