---
id: release-candidate-qualification-v1
title: 'Qualify AST release candidate v1'
stage: release
status: proposed
priority: medium
forward_to: []
depends_on:
    - ci-qualification-lanes-v1
    - legacy-surface-disposition-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/release-candidate-qualification-v1.md
    - docs/internal/php-json-ast/contracts/release-candidate-v1.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# release-candidate-qualification-v1: Qualify AST release candidate v1

## Objective

Record one exact release-candidate qualification across packages, packed consumers, CLI, WordPress and browser.

## Why this exists

A release decision needs one immutable evidence set tied to exact versions and artefacts.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Version matrix, commands, workflow URLs, artefact digests, waivers and rollback evidence.
- Performance baseline and reviewed thresholds.

## Out of scope

- Publishing to a registry and declaring all of WPKernel production-ready.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- All required qualification layers are linked to exact artefacts.
- No severity-one or severity-two waiver remains.
- Rollback and support boundaries are explicit.

## Verification

- Verify exact artefact digests, exercised qualification layers, waiver
  severities, performance thresholds, rollback evidence and support boundaries.
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
