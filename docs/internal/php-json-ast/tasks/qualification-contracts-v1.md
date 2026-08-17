---
architecture_version: 1
id: qualification-contracts-v1
title: 'Freeze WordPress and browser qualification contracts v1'
stage: contract
status: ready
priority: critical
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
depends_on:
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/qualification-contracts-v1.md
    - docs/internal/php-json-ast/contracts/runtime-qualification-v1.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# qualification-contracts-v1: Freeze WordPress and browser qualification contracts v1

## Objective

Define independent v1 API, browser and packed-artifact behaviours for the compiler spike.

## Why this exists

Runtime qualification must be stable before generators migrate so expected behaviour is not rewritten to fit generated output.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- WordPress activation, REST, CRUD, capability and persistence behaviours.
- Authenticated browser, DataView, localisation, block and SSR behaviours.
- Supported version matrix and diagnostic retention.

## Out of scope

- Generator changes, CI workflow changes and release claims.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- API and browser responsibilities are separated.
- Every runtime claim names packed artefacts and exact versions.
- Infrastructure retry and product retry policies are distinct.

## Verification

- `git diff --check`

## Required evidence

- Changed path list and exact base SHA.
- Verification commands, exit statuses and concise results.
- Contract, package and runtime versions exercised.
- Remaining known loss and requested coordinator actions.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and [`README.md`](README.md). Re-run admission immediately before claim.

## Work log

Execution mode: shared-checkout
Execution rationale: The declared scope is designed for the primary checkout.
Concurrency evaluation: evaluate against the live planner before claim; same-priority disjoint tasks may start alongside.
Concurrent task scopes: none recorded until claim.
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Not started.

### Files changed

None recorded.

### Verification evidence

Pending.

### Remaining risks

Pending implementation or review.

### Recommended next task

Follow the dependency graph in [`../ROADMAP.md`](../ROADMAP.md).
