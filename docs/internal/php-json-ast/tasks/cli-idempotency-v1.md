---
id: cli-idempotency-v1
title: 'Prove CLI migration idempotency and recovery v1'
stage: cli
status: proposed
priority: high
forward_to: []
depends_on:
    - cli-migration-manifest-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/cli-idempotency-v1.md
    - packages/cli/src/commands/__tests__/apply.idempotency.integration.test.ts
    - packages/cli/src/commands/__tests__/apply.recovery.integration.test.ts
    - packages/cli/src/commands/__fixtures__/migration-v1/**
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# cli-idempotency-v1: Prove CLI migration idempotency and recovery v1

## Objective

Prove generate, apply, repeat and interrupted recovery across the versioned migration fixture matrix.

## Why this exists

One successful apply does not establish user-code preservation, stable markers or recovery after interruption.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Released, beta, edited, dirty, conflicted, interrupted, renamed and removed-resource fixtures.
- Manifest and filesystem equivalence on repeated runs.

## Out of scope

- Packed dependency qualification and browser behaviour.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Second generate/apply is a no-op for all success fixtures.
- User-owned edits survive or produce explicit conflicts.
- Interrupted work resumes or rolls back without false success.

## Verification

- `pnpm --filter @wpkernel/cli test -- apply.idempotency.integration.test.ts apply.recovery.integration.test.ts --runInBand`
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
