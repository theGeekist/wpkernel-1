---
id: legacy-surface-disposition-v1
title: 'Decide legacy PHP generation surface disposition v1'
stage: integration
status: proposed
priority: medium
forward_to: []
depends_on:
    - compiler-public-entrypoints-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/legacy-surface-disposition-v1.md
    - docs/internal/php-json-ast/contracts/legacy-surface-disposition-v1.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# legacy-surface-disposition-v1: Decide legacy PHP generation surface disposition v1

## Objective

Classify the legacy program builder, printables, installer, NodeFinder and BuilderFactory surfaces as retain, remove or experimental.

## Why this exists

The new public fronts should not leave three apparently equivalent generation models without an explicit support decision.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Usage evidence, compatibility cost, removal version and migration owner.
- Public versus experimental support statements.

## Out of scope

- Source removal and publication.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Every legacy surface has one disposition and rationale.
- Removal candidates name a version and migration path.
- Experimental surfaces cannot be mistaken for supported authoring.

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
