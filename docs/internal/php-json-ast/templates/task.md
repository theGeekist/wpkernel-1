---
architecture_version: 1
id: TASK-ID
title: Task title
stage: contract
status: proposed
priority: normal
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: null
owner_kind: null
lease_started_at: null
lease_expires_at: null
base_sha: null
branch: null
worktree: null
depends_on: []
decision_dependencies: []
conflicts_with: []
write_scope: []
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: Preserve the compiler boundary and recovered evidence relevant to this task.
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: YYYY-MM-DD
---

# TASK-ID: Task title

## Objective

One testable outcome.

## Why this exists

## Inputs

## In scope

## Out of scope

## Contract and naming constraints

## File ownership

After admission, workers may edit only `base_sha`, `branch`, `worktree`,
`updated_at`, the work log and handoff. The coordinator owns all lifecycle,
ownership, dependency, conflict, write-scope and reading-authority metadata.

## Acceptance criteria

## Verification

## Required evidence

- Changed file list.
- Exact verification commands, exit status and concise result.
- Contract or output version exercised.
- Remaining known loss.
- Commit SHA or patch reference when applicable.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and
[`../tasks/README.md`](../tasks/README.md).

## Work log

Execution mode: shared-checkout | dedicated-worktree
Execution rationale:
Concurrency evaluation:
Concurrent task scopes: none
Swarm delegation: none

## Blocker

## Handoff

### Result

### Files changed

### Verification evidence

### Remaining risks

### Recommended next task
