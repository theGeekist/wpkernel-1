---
architecture_version: 1
id: source-process-runner-v1
title: 'Implement bounded PHP process runner v1'
stage: source
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
    - source-bridge-contract-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/source-process-runner-v1.md
    - packages/php-json-ast/src/source/process-runner.ts
    - packages/php-json-ast/src/source/process-errors.ts
    - packages/php-json-ast/src/source/__tests__/process-runner.test.ts
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

# source-process-runner-v1: Implement bounded PHP process runner v1

## Objective

Implement the shared bounded process transport defined by source-bridge-v1.

## Why this exists

Parsing, printing and ingestion need one timeout, abort, output-limit and exit-classification implementation.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Process execution, framing, bounds and deterministic error mapping.
- Failure-injection tests without migrating current consumers.

## Out of scope

- Fragment parsing and existing driver/printer migration.

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

- Timeout, abort, signals, output caps and malformed envelopes are deterministic.
- Partial output cannot be accepted as success.
- The runner has no WordPress, CLI or workspace dependency.

## Verification

- `pnpm --filter @wpkernel/php-json-ast test -- process-runner.test.ts --runInBand`
- `pnpm --filter @wpkernel/php-json-ast typecheck`
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
