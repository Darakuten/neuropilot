# Phase 9 Plugin Design (Optional)

This document specifies an optional Paperclip plugin expansion after the base company package is running.

## Goal

Add research-native visualization panels without modifying core Paperclip pages.

## Proposed Panels

1. **Experiment Tracker**
   - Matrix view: experiment id x seed x metric
   - Status: queued/running/failed/succeeded
   - Links to source issues and artifacts

2. **Paper Draft Status**
   - Section checklist: abstract/introduction/method/experiments/discussion/conclusion
   - Per-section reviewer status and unresolved findings
   - Version snapshots and diff links

3. **Literature Watch**
   - Daily ingested papers
   - Relevance score and novelty-risk tags
   - One-click issue creation for follow-up tasks

## Data Sources

- `issues`, `issue_comments`, `issue_documents`
- `heartbeat_runs`, `cost_events`
- routine trigger/run metadata

## Integration Strategy

- Implement as plugin-side UI pages and API endpoints
- Keep company package portable by not requiring plugin presence
- Feature flag plugin pages per company

## Acceptance Criteria

- No regression in existing Paperclip routes
- All panels render from existing control-plane data
- Users can complete end-to-end loop without plugin; plugin adds observability only
