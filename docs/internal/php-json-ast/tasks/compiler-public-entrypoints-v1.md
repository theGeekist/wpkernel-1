---
architecture_version: 1
id: compiler-public-entrypoints-v1
title: 'Publish and pack-qualify compiler fronts v1'
stage: integration
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
    - typed-fragments-v1
    - source-runtime-convergence-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/compiler-public-entrypoints-v1.md
    - packages/php-json-ast/package.json
    - packages/php-json-ast/src/index.ts
    - packages/php-json-ast/src/authoring/public.ts
    - packages/php-json-ast/src/source/public.ts
    - packages/php-json-ast/src/__tests__/entrypoints.test.ts
    - packages/php-json-ast/src/__tests__/packed-consumer.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# compiler-public-entrypoints-v1: Publish and pack-qualify compiler fronts v1

## Objective

Expose and packed-qualify the explicit AST, codec, authoring, source and pipeline fronts.

## Why this exists

Workspace imports and internal modules do not prove that an external consumer receives the versioned compiler boundaries.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Export map, public fronts, packed runtime and strict TypeScript consumer.
- Legacy root compatibility decision for the spike.

## Out of scope

- WordPress generator migration and broad legacy cleanup.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- A clean packed consumer authors, parses, prints and ingests through public imports only.
- Unsupported deep imports fail mechanically.
- Package metadata states the exact public boundary.

## Verification

- `pnpm --filter @wpkernel/php-json-ast build`
- `pnpm --filter @wpkernel/php-json-ast test -- entrypoints.test.ts packed-consumer.test.ts --runInBand`
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
