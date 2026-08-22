---
architecture_version: 1
id: browser-qualification-v1
title: 'Implement browser qualification v1'
stage: qualification
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
    - packed-plugin-harness-v1
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/browser-qualification-v1.md
    - examples/showcase/__tests__/e2e/wordpress-browser.spec.ts
    - examples/showcase/__tests__/e2e/support/browser-fixtures.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
    - path: docs/internal/php-json-ast/tasks/qualification-contracts-v1.md
      reason: 'Dependency-produced reading: the coordinator adds contracts/runtime-qualification-v1.md after the contract task is done.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
    - docs/internal/php-json-ast/tasks/qualification-contracts-v1.md
review_owner: coordinator
updated_at: 2026-08-13
---

# browser-qualification-v1: Implement browser qualification v1

## Objective

Implement authenticated browser contracts for admin, DataViews, localisation, blocks and server rendering.

## Why this exists

Browser behaviour is a separate product boundary and should not be mixed with REST setup or generator assertions.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Admin login and menu, DataView load and CRUD errors, localised assets, JS block registration and SSR.
- Selector and browser diagnostic policy.

## Out of scope

- REST contract implementation and generator source.

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

- Tests authenticate explicitly and use stable product selectors.
- No product retry disguises a generated-code defect.
- Browser traces and runtime diagnostics survive failure.

## Verification

- `pnpm exec playwright test wordpress-browser.spec.ts`
- Force one browser-contract failure and verify that its trace, screenshot and
  WordPress runtime diagnostics are retained.
- `git diff --check`

## Required evidence

- Changed path list and exact base SHA.
- Verification commands, exit statuses and concise results.
- Contract, package and runtime versions exercised.
- Remaining known loss and requested coordinator actions.

## Claim protocol

Follow [`../COORDINATION.md`](../COORDINATION.md) and [`README.md`](README.md).
The coordinator must add
`docs/internal/php-json-ast/contracts/runtime-qualification-v1.md` to both
reading fields after verifying the completed contract and before this task is
admitted. Re-run admission immediately before claim.

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
