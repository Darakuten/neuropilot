# AutoSOTA-Inspired Dynamic Multi-Agent Topology for DL Research

## Goal

Incorporate AutoSOTA's strengths (stage-specialized decomposition and long-horizon
experiment resilience) into the existing Paperclip-based DL Research company
without breaking current governance, skill assignment, and issue-based execution.

## Current vs AutoSOTA: Key Differences

### Current DL Research (Paperclip-based)

- Strong human-in-the-loop governance via issue threads and approvals
- Stable role set (PI, ideator, lit-scout, experimenter, engineer, critic, writer, worker, mentor)
- Theme launch creates mostly fixed child pipelines
- Good traceability, but topology is not yet explicitly re-optimized per domain

### AutoSOTA-style design (from arXiv:2604.05550)

- Eight specialized agents mapped to three macro stages:
  - preparation/goal setting
  - experiment evaluation/repair
  - reflection/ideation/supervision
- Strong emphasis on:
  - paper-to-code grounding
  - long-horizon monitoring and repair
  - iterative idea scheduling under constraints
- Dynamic stage coupling instead of purely linear pipelines

## Pro/Con Analysis for Adoption

### Pros of adopting AutoSOTA ideas

- Better fit for long-running noisy experiments (repair + monitor loops)
- Explicit stage decomposition reduces monolithic PI overload
- Higher chance of converting literature insight into executable deltas
- Better handling of "reproduce first, then optimize" lifecycle

### Cons / risks

- More orchestration complexity (reshaping pipelines mid-flight)
- Higher risk of run contention and budget spikes if unconstrained
- Increased governance surface (who can reshape what, when)
- Potential over-automation in domains where human novelty judgment dominates

## Recommended Hybrid Architecture

Keep Paperclip governance and issue lifecycle as the execution substrate, then
add **theme-profile-based topology shaping** as a policy layer.

### 1) Theme profile (computed at launch)

For each `[Theme]` issue, score:

- domain (`llm|nlp|cv|timeseries|systems|other`)
- evidence scarcity (`low|medium|high`)
- infra volatility (`low|medium|high`)
- run horizon (`short|long`)
- novelty target (`incremental|architectural`)

### 2) Role-weight mapping

Generate normalized role weights from profile:

- evidence scarcity high -> boost `lit-scout`, `critic`
- infra volatility high -> boost `engineer`, `experimenter`
- novelty target architectural -> boost `ideator`, `mentor`, `pi`
- publication-near milestone -> boost `writer`, `critic`

### 3) Concurrency caps by role (anti-conflict)

Apply run caps to avoid PI and adapter contention:

- `pi <= 1`
- `engineer <= 2`
- `experimenter <= 2`
- configurable per company and per theme

If cap reached, queue non-urgent wakes with explicit reason comment.

### 4) Milestone-triggered topology reshaping

At major milestones:

- baseline reproduced
- first failed optimization batch
- first statistically significant gain
- pre-writing freeze

Recompute profile + weights, then adjust child issue plan:

- add/remove tracks
- reassign owners
- update blockedBy edges
- keep full decision log in parent issue comments

## Concrete Implementation Proposal

### A. New policy skill (implemented)

- `companies/dl-research/skills/autosota-topology-optimizer/SKILL.md`
- Used by PI/Mentor to produce `topology-plan` structured decisions

### B. Theme launch extension

In `dl-research-chat` promotion flow:

1. run topology planner before creating child issues
2. persist `themeProfile` + `roleWeights` into parent issue comment
3. instantiate only selected tracks
4. resume only agents needed for selected tracks

### C. Heartbeat scheduling guard

Extend heartbeat with optional role-level run cap checks before wake scheduling:

- prevent concurrent duplicate PI runs
- prevent adapter config race by serialization at role level

### D. Observability

Add two metrics:

- `theme_topology_reshapes_total`
- `run_queue_delay_by_role_seconds`

Use these to verify optimization does not trade quality for instability.

## Rollout Plan

1. Phase 1 (safe): planner comments only, no automatic reshaping
2. Phase 2: automatic child-issue selection at theme launch
3. Phase 3: milestone-based auto-reshape with strict caps and approvals

## Success Criteria

- Lower PI no-response incidents from run conflicts
- Lower stale/recovery issue loops on parent themes
- Higher percentage of themes reaching "reproduced baseline" in bounded time
- No regressions in governance traceability

