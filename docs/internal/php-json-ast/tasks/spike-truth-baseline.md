---
id: spike-truth-baseline
title: 'Freeze the recovered spike baseline'
stage: baseline
status: done
priority: critical
evidence_milestone: 'Recovered G0 and spike baseline'
forward_to: []
depends_on: []
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/spike-truth-baseline.md
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# spike-truth-baseline: Freeze the recovered spike baseline

## Objective

Preserve the verified dependency direction, codec boundary, authoring baseline, CLI fixture matrix and runtime qualification gaps from the recovered spike.

## Why this exists

All continuing work needs one completed dependency that names the evidence boundary without treating later uncommitted repairs as released capability.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Record the G0, codec, authoring, CLI and E2E evidence already established.
- Keep implementation, package, packed and runtime qualification claims distinct.

## Out of scope

- Re-running or expanding the spike.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- The continuing graph has one stable completed baseline dependency.
- No current uncommitted implementation is claimed by this task.

## Verification

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
Execution rationale: Historical baseline only; no implementation paths are owned.
Concurrency evaluation: no concurrency restriction.
Concurrent task scopes: none
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Baseline recorded.

### Files changed

None recorded.

### Verification evidence

See the recovered roadmap evidence index and status log.

### Remaining risks

Later working-tree corrections are not part of this completed baseline.

### Recommended next task

Follow the dependency graph in [`../ROADMAP.md`](../ROADMAP.md).
