---
id: source-fragment-parser-v1
title: 'Implement batched source-fragment parsing v1'
stage: source
status: proposed
priority: high
forward_to: []
depends_on:
    - source-process-runner-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/source-fragment-parser-v1.md
    - packages/php-json-ast/src/source/fragments.ts
    - packages/php-json-ast/src/source/__tests__/fragments.test.ts
    - packages/php-json-ast/php/parse-fragments.php
    - packages/php-json-ast/php/tests/FragmentParsingTest.php
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
    - path: docs/internal/php-json-ast/tasks/source-bridge-contract-v1.md
      reason: 'Dependency-produced reading: the coordinator adds contracts/source-bridge-v1.md after the contract task is done.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
    - docs/internal/php-json-ast/tasks/source-bridge-contract-v1.md
review_owner: coordinator
updated_at: 2026-08-13
---

# source-fragment-parser-v1: Implement batched source-fragment parsing v1

## Objective

Parse bounded batches of PHP fragments with correlation and fragment-local diagnostics.

## Why this exists

Typed fragments need a safe compiler bridge without source interpolation or per-fragment process overhead.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Versioned batch requests, PHP parser entry point and TypeScript adapter.
- Fragment-aware syntax and source-location errors.

## Out of scope

- Authoring interpolation and existing printer or ingestion migration.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

After admission, workers may edit only `base_sha`, `branch`, `worktree`,
`updated_at`, the work log and handoff. The coordinator owns all lifecycle,
ownership, dependency, conflict, write-scope and reading-authority metadata.
Request coordinator integration for shared exports, manifests, lockfiles,
generated documentation or CI not explicitly named above.

## Acceptance criteria

- Batch outputs preserve input correlation and order.
- One failed fragment cannot be attributed to another.
- Generated AST uses the canonical codec.

## Verification

- `pnpm --filter @wpkernel/php-json-ast test -- fragments.test.ts --runInBand`
- `composer test --working-dir packages/php-json-ast/php`
- `git diff --check`

## Required evidence

- Changed path list and exact base SHA.
- Verification commands, exit statuses and concise results.
- Contract, package and runtime versions exercised.
- Remaining known loss and requested coordinator actions.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and [`README.md`](README.md). Re-run admission immediately before claim.
The coordinator must add `docs/internal/php-json-ast/contracts/source-bridge-v1.md`
to both reading fields after verifying the completed contract and before this
task is admitted.

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
