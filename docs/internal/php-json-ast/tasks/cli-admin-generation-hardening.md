---
architecture_version: 1
id: cli-admin-generation-hardening
title: 'Harden generated admin capabilities and form fields'
stage: cli
status: done
priority: critical
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: codex-root
owner_kind: coordinator
lease_started_at: '2026-08-13T00:00:00+08:00'
lease_expires_at: '2026-08-14T00:00:00+08:00'
base_sha: '9930f6b8fb368da3c80392140184e472c0217607'
branch: recover/dirty-work-20260817
worktree: '/private/tmp/wpkernel-dirty-integration-20260817.qhJStU'
depends_on:
    - spike-truth-baseline
decision_dependencies: []
conflicts_with: []
write_scope:
    - docs/internal/php-json-ast/tasks/cli-admin-generation-hardening.md
    - packages/cli/src/builders/ts/admin-screen.ts
    - packages/cli/src/builders/ts/app-config.ts
    - packages/cli/src/builders/ts/app-form.ts
    - packages/cli/src/builders/ts/__tests__/app-config.test.ts
    - packages/cli/src/builders/ts/__tests__/app-form.branches.test.ts
    - packages/cli/src/builders/ts/__tests__/ts.admin-screen.test.ts
required_reading:
    - path: docs/internal/php-json-ast/authoring-roadmap.md
      reason: 'Preserve the compiler boundary, recovered evidence and qualification distinctions relevant to this task.'
read_scope:
    - docs/internal/php-json-ast/authoring-roadmap.md
review_owner: coordinator
updated_at: 2026-08-17
---

# cli-admin-generation-hardening: Harden generated admin capabilities and form fields

## Objective

Complete review of route-capability gating, taxonomy aliases and supported WP-post form fields in generated admin code.

## Why this exists

These corrections are already in the working tree and are disjoint from CLI codemod and migration-manifest ownership.

## Inputs

- Direct dependency briefs supplied by the task context compiler.
- The versioned contract named by this task or its dependency, when applicable.

## In scope

- Create, update, delete and quick-edit capability derivation.
- Taxonomy alias field identity and editor/excerpt payload fields.

## Out of scope

- Codemod target wiring, apply manifests and packed CLI qualification.

## Contract and naming constraints

- Preserve the dependency direction `wp-json-ast -> php-json-ast/authoring -> php-json-ast/ast`.
- Consume exact v1 contracts. Do not silently broaden a versioned shape.
- Do not add a competing PHP DSL in WordPress or CLI code.

## File ownership

Only edit this task, its declared write scope, work log and handoff. Request coordinator integration for shared exports, manifests, lockfiles, generated documentation or CI not explicitly named above.

## Acceptance criteria

- Unavailable routes do not produce unusable UI actions.
- Alias-keyed taxonomy values render through their storage keys.
- Supported core fields round trip intentional empty values.

## Verification

- `pnpm --filter @wpkernel/cli test -- app-config.test.ts app-form.branches.test.ts ts.admin-screen.test.ts --runInBand`
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
Execution rationale: Existing working-tree corrections are bounded to the exact paths above.
Concurrency evaluation: start alongside the other review tasks and contract frontier; all declared scopes are disjoint.
Concurrent task scopes: authoring-foundation-hardening, wordpress-mutation-hardening and cli-admin-generation-hardening own separate package paths.
Swarm delegation: none

## Blocker

None recorded.

## Handoff

### Result

Completed route-aware generated actions, taxonomy alias field identity,
content and excerpt form support, intentional empty-string payload handling and
removal of the fabricated item-fetch fallback.

### Files changed

All CLI generator source and test paths declared in `write_scope`.

### Verification evidence

- `pnpm --filter @wpkernel/cli test -- app-config.test.ts app-form.branches.test.ts ts.admin-screen.test.ts --runInBand`:
  4 suites and 19 tests passed.
- `pnpm --filter @wpkernel/cli typecheck`: passed after building the local
  `wp-json-ast` dependency in the isolated integration worktree.
- Focused Prettier check and `git diff --check`: passed.

### Remaining risks

Route capability inference recognises the declared identity parameter in colon
or brace form. Custom route templates outside that IR convention remain out of
scope. Content and excerpt deliberately use the current text-field surface,
not a rich editor.

### Recommended next task

`cli-migration-contract-v1`, then `cli-codemod-repair-v1`.
