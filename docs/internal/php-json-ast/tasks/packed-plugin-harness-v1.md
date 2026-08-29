---
id: packed-plugin-harness-v1
title: 'Establish packed generated-plugin harness v1'
stage: qualification
status: proposed
priority: high
forward_to: []
depends_on:
    - qualification-contracts-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/packed-plugin-harness-v1.md
    - examples/showcase/__tests__/e2e/support/packed-plugin-harness.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the recovered packed-plugin boundary and runtime qualification distinctions.'
    - path: docs/internal/php-json-ast/tasks/qualification-contracts-v1.md
      reason: 'Dependency-produced reading: the coordinator adds contracts/runtime-qualification-v1.md after the contract task is done.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
    - docs/internal/php-json-ast/tasks/qualification-contracts-v1.md
review_owner: coordinator
updated_at: 2026-08-22
---

# packed-plugin-harness-v1: Establish packed generated-plugin harness v1

## Objective

Create the deterministic packed generated-plugin fixture required by the API and
browser qualification tasks.

## Why this exists

Runtime contracts are only meaningful when they exercise the installed packed
plugin rather than workspace aliases or an inferred generated tree.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned qualification contract from `qualification-contracts-v1`.

## In scope

- Clean install, activation and provenance receipt for one packed generated
  plugin fixture.
- A reusable fixture seam for API and browser qualification.

## Out of scope

- API or browser assertions, generator migration and registry publication.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

After admission, workers may edit only `base_sha`, `branch`, `worktree`,
`updated_at`, the work log and handoff. The coordinator owns all lifecycle,
ownership, dependency, conflict, write-scope and reading-authority metadata.
Request coordinator integration for Playwright configuration, generated
fixtures, manifests, lockfiles or CI.

## Acceptance criteria

- The fixture installs an exact packed artifact, not a workspace alias.
- Activation records the package version, artifact digest, WordPress and PHP
  versions.
- API and browser qualification can consume the same fixture without creating a
  second installation path.

## Verification

- `pnpm exec playwright test --list`
- Exercise clean packed-plugin installation and activation, retaining the
  artifact digest and runtime logs.
- `git diff --check`

## Required evidence

- Changed path list and exact base SHA.
- Verification commands, exit statuses and concise result.
- Packed artifact digest, package version and PHP/WordPress versions exercised.
- Remaining known loss and requested coordinator actions.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and [`README.md`](README.md).
The coordinator must add
`docs/internal/php-json-ast/contracts/runtime-qualification-v1.md` to both
reading fields after verifying the completed contract and before this task is
admitted. Re-run admission immediately before claim.

## Work log

Execution mode: shared-checkout
Execution rationale: The fixture seam is disjoint from API and browser assertions.
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

`wordpress-api-qualification-v1` and `browser-qualification-v1` after this
fixture is qualified.
