---
id: cli-packed-qualification-v1
title: 'Qualify packed CLI migration v1'
stage: qualification
status: proposed
priority: high
forward_to: []
depends_on:
    - cli-idempotency-v1
    - compiler-public-entrypoints-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/cli-packed-qualification-v1.md
    - packages/cli/src/commands/__tests__/packed-migration.integration.test.ts
    - packages/cli/src/commands/__fixtures__/packed-migration/**
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# cli-packed-qualification-v1: Qualify packed CLI migration v1

## Objective

Run init, generate, apply and doctor from a packed CLI with packed compiler and WordPress dependencies.

## Why this exists

Workspace aliases can hide missing exports, files and dependency declarations.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Clean external consumer install and version receipts.
- Generated PHP lint and manifest assertions.

## Out of scope

- Registry publication and WordPress browser qualification.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- No workspace path or deep import is required.
- Packed versions are recorded in evidence.
- All emitted PHP passes syntax validation.

## Verification

- `pnpm --filter @wpkernel/cli test -- packed-migration.integration.test.ts --runInBand`
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
