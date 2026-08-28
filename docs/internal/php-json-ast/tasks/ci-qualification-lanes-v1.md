---
id: ci-qualification-lanes-v1
title: 'Add packed AST qualification lanes v1'
stage: integration
status: proposed
priority: medium
forward_to: []
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
updated_at: 2026-08-24
---

# ci-qualification-lanes-v1: Add packed AST qualification lanes v1

## Objective

Extend the repository's ordinary quality gate with packed AST, CLI, WordPress
and browser qualification while preserving one minimal trusted-publishing
release path.

## Why this exists

Local evidence is not durable until clean CI reproduces the supported version matrix and uploads diagnostics.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Packed-artifact qualification inside the ordinary quality gate and a
  minimum/current PHP and WordPress release matrix.
- Diagnostic and provenance artefact retention.

## Out of scope

- Registry publication and unrelated CI restructuring.
- Verifier Apps, exact-diff approval jobs, required independent-approval
  checks, release-specific approval pull requests, governance pull-request
  chains and TaskGraph's multi-workflow release ceremony.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.
- Keep one version and tag, one package qualification and trusted-publishing
  path, and one ordinary quality gate. Do not split publication authority into
  additional WPKernel workflows merely to mirror another repository.
- CodeRabbit is the external pull-request reviewer. The repository owner
  retains merge and close authority.
- Local semantic review is supporting evidence. It must not become a required
  GitHub job, exact-diff approval envelope or independent merge authority.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- PR qualification uses packed artefacts and deterministic runtime setup.
- Release matrix names exact supported versions.
- Failures upload actionable PHP, WordPress, REST and browser evidence.
- The resulting CI and release shape contains no verifier App, exact-diff
  approval job, release-approval pull request or governance pull-request chain.

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
