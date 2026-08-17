---
architecture_version: 1
id: typed-fragments-v1
title: 'Implement typed PHP fragments v1'
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
    - authoring-declarations-v1
    - source-fragment-parser-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/typed-fragments-v1.md
    - packages/php-json-ast/src/authoring/fragments.ts
    - packages/php-json-ast/src/authoring/compile.ts
    - packages/php-json-ast/src/authoring/__tests__/fragments.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# typed-fragments-v1: Implement typed PHP fragments v1

## Objective

Implement typed fragment interpolation that compiles through source-bridge-v1 into canonical AST.

## Why this exists

Fragments provide ergonomic source-shaped authoring only when interpolations remain typed and unsafe insertion is explicit.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Typed values, references, expressions, statements and declarations.
- Explicitly named unsafe source escape hatch and provenance tests.

## Out of scope

- Package exports and WordPress migration.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Safe interpolation cannot inject unparsed source.
- Unsafe insertion is explicit, reviewable and separately tested.
- Fragment output composes with declaration and file authoring.

## Verification

- `pnpm --filter @wpkernel/php-json-ast test -- authoring/fragments.test.ts --runInBand`
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
