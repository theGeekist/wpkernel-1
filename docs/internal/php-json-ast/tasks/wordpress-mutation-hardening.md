---
architecture_version: 1
id: wordpress-mutation-hardening
title: 'Harden WordPress mutation lowering'
stage: wordpress
status: review
priority: critical
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: codex-root
owner_kind: coordinator
lease_started_at: '2026-08-13T00:00:00+08:00'
lease_expires_at: '2026-08-14T00:00:00+08:00'
base_sha: 'e5ec9b740e953f8d61e2e273516b0e3ccd83cbf6'
branch: main
worktree: '/Users/jasonnathan/Repos/wpkernel'
depends_on:
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/wordpress-mutation-hardening.md
    - packages/wp-json-ast/src/resource/wp-post/mutation/meta.ts
    - packages/wp-json-ast/src/resource/wp-post/mutation/taxonomies.ts
    - packages/wp-json-ast/src/resource/wp-post/mutation/__tests__/helpers.test.ts
    - packages/wp-json-ast/src/resource/wp-post/mutation/__tests__/__snapshots__/helpers.test.ts.snap
    - packages/cli/src/builders/php/__tests__/__snapshots__/resourceController.test.ts.snap
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-13
---

# wordpress-mutation-hardening: Harden WordPress mutation lowering

## Objective

Complete review of generated WP-post meta and taxonomy request handling and its downstream PHP snapshots.

## Why this exists

The current working tree fixes an undefined WordPress sanitiser call and must be tracked separately from future bootstrap and REST migrations.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Request parameter lowering for meta and taxonomy mutation helpers.
- Focused helper and generated-controller snapshots.

## Out of scope

- Bootstrap migration, REST module migration and browser qualification.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Generated PHP calls supported WordPress request APIs.
- Meta and taxonomy helper regressions cover the generated AST.
- Focused tests, lint and typecheck pass.

## Verification

- `pnpm --filter @wpkernel/wp-json-ast test -- helpers.test.ts --runInBand`
- `pnpm --filter @wpkernel/wp-json-ast typecheck`
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
Execution rationale: Existing working-tree corrections are bounded to the exact paths above.
Concurrency evaluation: start alongside the other review tasks and contract frontier; all declared scopes are disjoint.
Concurrent task scopes: authoring-foundation-hardening, wordpress-mutation-hardening and cli-admin-generation-hardening own separate package paths.
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Implementation corrections are present in the working tree and awaiting final review.

### Files changed

See the exact write scope and current Git diff.

### Verification evidence

Pending.

### Remaining risks

Pending implementation or review.

### Recommended next task

Follow the dependency graph in [`../ROADMAP.md`](../ROADMAP.md).
