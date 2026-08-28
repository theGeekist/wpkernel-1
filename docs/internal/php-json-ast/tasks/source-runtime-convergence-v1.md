---
id: source-runtime-convergence-v1
title: 'Converge printer and ingestion on source bridge v1'
stage: source
status: proposed
priority: high
forward_to: []
depends_on:
    - source-process-runner-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/source-runtime-convergence-v1.md
    - packages/php-json-ast/src/source/parse.ts
    - packages/php-json-ast/src/source/print.ts
    - packages/php-json-ast/src/source/ingest.ts
    - packages/php-json-ast/src/source/public.ts
    - packages/php-json-ast/src/source/__tests__/runtime-convergence.test.ts
    - packages/php-json-ast/src/driver/ingestionRunner.ts
    - packages/php-json-ast/src/prettyPrinter/createPhpPrettyPrinter.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# source-runtime-convergence-v1: Converge printer and ingestion on source bridge v1

## Objective

Route parsing, printing and ingestion through the shared v1 process transport without fixture drift.

## Why this exists

A shared protocol has no value while production entry points retain separate execution and normalisation paths.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Adapters over the shared runner and equivalence fixtures.
- Removal of duplicated process behaviour only after parity is proven.

## Out of scope

- Fragments, root exports and package manifest changes.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Existing parse, print and ingestion fixtures remain structurally equivalent.
- All operations return versioned errors from one taxonomy.
- Legacy adapters do not spawn their own competing process path.

## Verification

- `pnpm --filter @wpkernel/php-json-ast test -- runtime-convergence.test.ts prettyPrinter.test.ts programIngestion.test.ts --runInBand`
- `pnpm --filter @wpkernel/php-json-ast typecheck`
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
