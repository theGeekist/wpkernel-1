---
architecture_version: 1
id: authoring-foundation-hardening
title: 'Harden generic authoring and codec boundaries'
stage: authoring
status: done
priority: critical
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: codex-root
owner_kind: coordinator
lease_started_at: '2026-08-13T00:00:00+08:00'
lease_expires_at: '2026-08-14T00:00:00+08:00'
base_sha: 'e5ec9b740e953f8d61e2e273516b0e3ccd83cbf6'
branch: main
worktree: '/Users/jasonnathan/Repos/wpkernel'
depends_on:
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/authoring-foundation-hardening.md
    - packages/php-json-ast/src/__tests__/entrypoints.test.ts
    - packages/php-json-ast/src/__tests__/nodes.base.test.ts
    - packages/php-json-ast/src/authoring/properties.ts
    - packages/php-json-ast/src/authoring/references.ts
    - packages/php-json-ast/src/authoring/values.ts
    - packages/php-json-ast/src/authoring/expressions.ts
    - packages/php-json-ast/src/authoring/statements.ts
    - packages/php-json-ast/src/authoring/__tests__/values.test.ts
    - packages/php-json-ast/src/authoring/__tests__/expressions.test.ts
    - packages/php-json-ast/src/authoring/__tests__/statements.test.ts
    - packages/php-json-ast/src/codec/normalize.ts
    - packages/php-json-ast/src/codec/__tests__/codec.test.ts
    - packages/php-json-ast/src/nodes/base.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-17
---

# authoring-foundation-hardening: Harden generic authoring and codec boundaries

## Objective

Complete review of the descriptor provenance, accessor-safe collection handling, codec key preservation and generic node invariants already present in the working tree.

## Why this exists

These corrections are the safe foundation for declarations and typed fragments, but their current review state must not reserve unrelated source-bridge or qualification files.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Review and correct only the existing authoring, codec and node-boundary diff.
- Retain module-private provenance and descriptor-safe reads.

## Out of scope

- Declarations, imports, files, fragments or package export work.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Forged descriptors and accessor-backed records or arrays are rejected without execution.
- Codec round trips preserve legal dynamic keys including **proto**.
- Focused tests and typechecks pass.

## Verification

- `pnpm --filter @wpkernel/php-json-ast test -- --runInBand`
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
Execution rationale: Existing working-tree corrections are bounded to the exact paths above.
Concurrency evaluation: start alongside the other review tasks and contract frontier; all declared scopes are disjoint.
Concurrent task scopes: authoring-foundation-hardening, wordpress-mutation-hardening and cli-admin-generation-hardening own separate package paths.
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Completed the authoring provenance, accessor-safe collection, codec key and
node identity corrections. Runtime descriptor brands are now module-private
`WeakSet` membership rather than discoverable symbol properties.

### Files changed

All package source and test paths declared in `write_scope`.

### Verification evidence

- `pnpm --filter @wpkernel/php-json-ast test -- --runInBand`: 29 suites and
  187 tests passed in the qualified recovery run.
- Repository-wide pre-commit coverage and source/test typechecks passed in the
  primary checkout.
- `pnpm --filter @wpkernel/php-json-ast typecheck`: passed.
- `pnpm exec prettier --check 'packages/php-json-ast/src/**/*.ts' docs/internal/php-json-ast/tasks/authoring-foundation-hardening.md`: passed.
- `git diff --check`: passed.

### Remaining risks

JavaScript `Proxy` traps remain outside the plain-record authoring contract.

### Recommended next task

`authoring-declarations-contract-v1`.
