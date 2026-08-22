---
architecture_version: 1
id: source-bridge-contract-v1
title: 'Freeze PHP source bridge protocol v1'
stage: contract
status: ready
priority: critical
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
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/source-bridge-contract-v1.md
    - docs/internal/php-json-ast/contracts/source-bridge-v1.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# source-bridge-contract-v1: Freeze PHP source bridge protocol v1

## Objective

Define one deterministic v1 request, success and error envelope for PHP parsing, printing, ingestion and fragment batches.

## Why this exists

The current PHP executables duplicate transport, process and JSON assumptions, preventing a shared runner from being implemented independently.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Protocol discriminants, versions, limits and error taxonomy.
- Batch correlation, source locations, stderr and process termination semantics.

## Out of scope

- Process-runner or PHP executable implementation.

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

- Every current bridge operation maps to one versioned envelope.
- Timeout, abort, malformed output, missing assets and oversized output are classified.
- Unknown protocol versions fail closed.
- The completed handoff identifies `contracts/source-bridge-v1.md` as the
  dependency-produced reading that the coordinator must add before admitting
  its consumers.

## Verification

- Review versioned fixtures for every request, success and error envelope,
  including unsupported versions, timeout, abort, malformed output, missing
  assets, output caps and partial output.
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
