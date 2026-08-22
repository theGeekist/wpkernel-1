---
architecture_version: 1
id: ci-qualification-lanes-v1
title: 'Add packed AST qualification lanes v1'
stage: integration
status: proposed
priority: medium
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
    - dual-path-runtime-parity-v1
    - cli-packed-qualification-v1
    - browser-qualification-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/ci-qualification-lanes-v1.md
    - .github/workflows/ci.yml
    - playwright.config.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# ci-qualification-lanes-v1: Add packed AST qualification lanes v1

## Objective

Add fast pull-request and wider release lanes for packed AST, CLI, WordPress and browser qualification.

## Why this exists

Local evidence is not durable until clean CI reproduces the supported version matrix and uploads diagnostics.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Fast packed-artifact PR lane and minimum/current PHP and WordPress release matrix.
- Diagnostic and provenance artefact retention.

## Out of scope

- Registry publication and unrelated CI restructuring.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- PR qualification uses packed artefacts and deterministic runtime setup.
- Release matrix names exact supported versions.
- Failures upload actionable PHP, WordPress, REST and browser evidence.

## Verification

- `pnpm exec prettier --check .github/workflows/ci.yml playwright.config.ts`
- `pnpm exec playwright test --list`
- Record the exact PHP and WordPress version matrix exercised by each release lane.
- Force one representative failure and verify that its PHP, WordPress, REST and
  browser diagnostics are retained as CI artefacts.
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
