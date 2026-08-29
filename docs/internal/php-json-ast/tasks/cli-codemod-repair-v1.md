---
id: cli-codemod-repair-v1
title: 'Reconnect CLI codemod execution to migration contract v1'
stage: cli
status: ready
priority: high
forward_to: []
depends_on:
    - cli-migration-contract-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/cli-codemod-repair-v1.md
    - packages/cli/src/builders/php/pipeline.codemods.ts
    - packages/cli/src/builders/php/pipeline.builder.ts
    - packages/cli/src/builders/php/__tests__/pipeline.codemods.test.ts
    - packages/cli/src/dx/readiness/helpers/phpCodemodIngestion.ts
    - packages/cli/src/dx/readiness/helpers/__tests__/phpCodemodIngestion.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
    - path: docs/internal/php-json-ast/contracts/cli-migration-v1.md
      reason: Implement strict discovery and activation without weakening the frozen migration and ownership contract.
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
    - docs/internal/php-json-ast/contracts/cli-migration-v1.md
review_owner: coordinator
updated_at: 2026-08-25
---

# cli-codemod-repair-v1: Reconnect CLI codemod execution to migration contract v1

## Objective

Reconnect or explicitly replace advertised codemod configuration and reject empty-target false success.

## Why this exists

The CLI currently has a configured feature whose production pipeline may execute no real target.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Target resolution, configuration mapping, readiness and focused fixtures.
- Explicit diagnostics for unavailable or empty execution.

## Out of scope

- Migration manifest implementation and generated admin UI.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Configured targets reach the real runner.
- Empty targets cannot report successful migration.
- Tests exercise the real adapter boundary rather than only mocks.

## Verification

- `pnpm --filter @wpkernel/cli test -- pipeline.codemods.test.ts phpCodemodIngestion.test.ts --runInBand`
- `pnpm --filter @wpkernel/cli typecheck`
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
