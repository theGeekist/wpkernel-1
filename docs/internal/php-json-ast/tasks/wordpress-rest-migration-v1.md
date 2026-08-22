---
architecture_version: 1
id: wordpress-rest-migration-v1
title: 'Migrate representative REST slice to authoring v1'
stage: wordpress
status: proposed
priority: high
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
    - wordpress-bootstrap-migration-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/wordpress-rest-migration-v1.md
    - packages/wp-json-ast/src/rest-controller/imports.ts
    - packages/wp-json-ast/src/rest-controller/class.ts
    - packages/wp-json-ast/src/rest-controller/route.ts
    - packages/wp-json-ast/src/rest-controller/__tests__/authoring-parity.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# wordpress-rest-migration-v1: Migrate representative REST slice to authoring v1

## Objective

Migrate one REST registration slice covering imports, callbacks, arrays, comments and calls through authoring v1.

## Why this exists

A bootstrap alone does not exercise the semantic depth required by real WPKernel resources.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- One representative REST slice and dual-path fixtures.
- Raw-constructor measurement for the migrated files.

## Out of scope

- All WordPress generators and compatibility re-export cleanup.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Normalised AST and printed PHP match the accepted parity contract.
- The migrated slice reduces raw AST-specific calls by at least 60 percent.
- Runtime route behaviour remains unchanged.

## Verification

- `pnpm --filter @wpkernel/wp-json-ast test -- authoring-parity.test.ts --runInBand`
- `pnpm --filter @wpkernel/wp-json-ast typecheck`
- Record before-and-after raw AST-specific call counts for the named migrated
  files, including the exact search expression, inputs and calculation proving
  the required reduction.
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
