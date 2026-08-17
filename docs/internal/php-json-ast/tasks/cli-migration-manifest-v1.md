---
architecture_version: 1
id: cli-migration-manifest-v1
title: 'Implement migration manifest v1'
stage: cli
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
    - cli-codemod-repair-v1
    - wordpress-rest-migration-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/cli-migration-manifest-v1.md
    - packages/cli/src/apply/migration-manifest.ts
    - packages/cli/src/apply/__tests__/migration-manifest.test.ts
    - packages/cli/src/commands/apply/migration-report.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# cli-migration-manifest-v1: Implement migration manifest v1

## Objective

Emit the machine-readable v1 migration manifest for changed, unchanged, skipped, conflicted and failed targets.

## Why this exists

Upgrade automation and recovery require durable exact outcomes rather than console success language.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Manifest serialization, source and target versions, diagnostics and target identities.
- Compatibility fixtures from the v1 contract.

## Out of scope

- Full idempotency matrix and packed external CLI.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Every target produces exactly one terminal manifest entry.
- The manifest is deterministic and version-discriminated.
- Conflicts and partial failures cannot collapse into success.

## Verification

- `pnpm --filter @wpkernel/cli test -- migration-manifest.test.ts --runInBand`
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
