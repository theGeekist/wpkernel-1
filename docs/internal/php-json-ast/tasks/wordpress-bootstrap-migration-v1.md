---
architecture_version: 1
id: wordpress-bootstrap-migration-v1
title: 'Migrate plugin bootstrap to authoring v1'
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
    - compiler-public-entrypoints-v1
    - wordpress-mutation-hardening
    - qualification-contracts-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/wordpress-bootstrap-migration-v1.md
    - packages/wp-json-ast/src/plugin/bootstrap.ts
    - packages/wp-json-ast/src/plugin/__tests__/bootstrap.authoring.test.ts
    - examples/showcase/__tests__/e2e/bootstrap-parity.spec.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# wordpress-bootstrap-migration-v1: Migrate plugin bootstrap to authoring v1

## Objective

Migrate the representative plugin bootstrap through public authoring v1 behind a dual-path parity fixture.

## Why this exists

The package boundary is proven only when WordPress semantics consume it without moving WordPress concepts downward.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Bootstrap semantic plan and old/new normalized AST and PHP parity.
- Runtime activation through the existing packed showcase harness.

## Out of scope

- REST migration and generic helper cleanup.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Old and new paths consume the same semantic input.
- AST, printed PHP, ownership markers and activation behaviour agree.
- WordPress concepts remain in wp-json-ast.

## Verification

- `pnpm --filter @wpkernel/wp-json-ast test -- bootstrap.authoring.test.ts --runInBand`
- `pnpm exec playwright test bootstrap-parity.spec.ts`
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
