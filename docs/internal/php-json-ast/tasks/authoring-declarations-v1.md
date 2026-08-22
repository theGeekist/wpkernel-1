---
architecture_version: 1
id: authoring-declarations-v1
title: 'Implement authoring declarations v1'
stage: authoring
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
    - authoring-foundation-hardening
    - authoring-declarations-contract-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/authoring-declarations-v1.md
    - packages/php-json-ast/src/authoring/declarations.ts
    - packages/php-json-ast/src/authoring/imports.ts
    - packages/php-json-ast/src/authoring/file.ts
    - packages/php-json-ast/src/authoring/__tests__/declarations.test.ts
    - packages/php-json-ast/src/authoring/__tests__/file.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# authoring-declarations-v1: Implement authoring declarations v1

## Objective

Implement declarations, imports, namespaces and file composition exactly to authoring-declarations-v1.

## Why this exists

The generic layer needs complete program authoring before WordPress generators can stop assembling low-level declaration nodes.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- The files and tests declared in write_scope.
- Direct lowering to canonical AST with bounded validation.

## Out of scope

- Typed fragments, package exports and WordPress migration.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- All v1 contract cases lower to canonical AST.
- Unsupported cases fail with stable authoring errors.
- No WordPress or process dependency enters authoring.

## Verification

- `pnpm --filter @wpkernel/php-json-ast test -- declarations.test.ts file.test.ts --runInBand`
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
