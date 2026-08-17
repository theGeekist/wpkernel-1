---
architecture_version: 1
id: dual-path-runtime-parity-v1
title: 'Prove dual-path WordPress runtime parity v1'
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
    - wordpress-rest-migration-v1
    - wordpress-api-qualification-v1
    - browser-qualification-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/dual-path-runtime-parity-v1.md
    - examples/showcase/__tests__/e2e/authoring-dual-path.spec.ts
    - examples/showcase/__tests__/e2e/support/dual-path-fixtures.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# dual-path-runtime-parity-v1: Prove dual-path WordPress runtime parity v1

## Objective

Run old and authoring-v1 generated bootstrap and REST artefacts through the same API and browser contracts.

## Why this exists

AST or PHP snapshots cannot prove that the semantic migration preserves WordPress behaviour.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Same-input old/new generation and black-box comparison.
- Reviewed formatting-only allowlist and raw-AST call reduction evidence.

## Out of scope

- CI matrix changes and removal of the old path.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- API and browser outcomes match for both paths.
- Ownership markers and metadata remain compatible.
- Any allowed formatting delta is explicit and reviewed.

## Verification

- `pnpm exec playwright test authoring-dual-path.spec.ts`
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
