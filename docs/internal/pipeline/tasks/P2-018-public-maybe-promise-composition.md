---
architecture_version: 1
id: P2-018
title: Export the complete MaybePromise composition algebra
stage: source
status: done
priority: critical
evidence_milestone: 'Independent review clean; source/test typechecks, build, 82 suites and 564 tests, near-total coverage, and packed Bundler/strict NodeNext qualification passed'
replaced_by: []
forward_to:
    - P2-008
preferred_owner_kind: codex
owner: codex-root
owner_kind: codex
lease_started_at: 2026-08-22T12:09:09+08:00
lease_expires_at: 2026-08-22T16:09:09+08:00
base_sha: 629117f70c779ee1b84faef3bac40ed54cf0bc47
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-007
decision_dependencies:
    - ADR-003
conflicts_with:
    - P2-009
write_scope:
    - packages/pipeline/src/core/async-utils.ts
    - packages/pipeline/src/core/createExtension.ts
    - packages/pipeline/src/core/types.ts
    - packages/pipeline/src/core/__tests__/async-utils.test.ts
    - packages/pipeline/src/core/__tests__/async-utils.coverage.test.ts
    - packages/pipeline/src/core/__tests__/executor.test.ts
    - packages/pipeline/src/core/__tests__/extensions.test.ts
    - packages/pipeline/src/core/__tests__/ignored-lifecycle.test.ts
    - packages/pipeline/src/standard-pipeline/__tests__/public-entries.test.ts
    - packages/pipeline/src/v2/index.ts
    - packages/pipeline/src/v2/graph/types.ts
    - packages/pipeline/src/v2/scheduler/maybe-promise.ts
    - packages/pipeline/src/v2/__tests__/public-surface.test.ts
    - packages/pipeline/scripts/qualify-packed-api.mjs
    - packages/pipeline/README.md
    - docs/packages/pipeline/execution-and-effects.md
    - docs/internal/pipeline/contracts/v2-public-contract.md
    - docs/internal/pipeline/contracts/v2-vocabulary.md
    - docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
    - docs/internal/pipeline/ROADMAP.md
    - docs/internal/pipeline/tasks/P2-018-public-maybe-promise-composition.md
required_reading:
    - path: instructions/wpkernel-repository-guide.md
      reason: Preserve public TSDoc, generated documentation and packed qualification.
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Implement the accepted read-once synchronous-settlement algebra.
    - path: docs/internal/pipeline/contracts/v2-vocabulary.md
      reason: Export the complete settled utility vocabulary without a private subset.
    - path: docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
      reason: Separate authority containment from reusable FP composition.
read_scope:
    - instructions/wpkernel-repository-guide.md
    - packages/pipeline/src/**
    - packages/pipeline/scripts/**
    - packages/pipeline/README.md
    - docs/packages/pipeline/**
    - docs/internal/pipeline/**
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-018: Export the complete MaybePromise composition algebra

## Objective

Make the complete shared synchronous-or-asynchronous composition algebra a
first-class root contract rather than private interpreter machinery.

## Acceptance criteria

- The package root exports `MaybePromise`, `AwaitedTuple`,
  `adoptMaybePromise`, `isPromiseLike`, `maybeThen`, `maybeAll`, `maybeTry` and
  `processSequentially`.
- Public utilities and native v2 participant observation share one read-once
  thenable boundary. A throwing getter remains synchronous failure; a callable
  `then` is captured once and invoked through queued promise adoption.
- Direct mapping, joining, recovery and traversal stay direct until genuine
  asynchronous work appears.
- Async promotion never causes a direct sibling or callback result to be
  observed twice.
- `maybeAll` preserves readonly tuple positions and heterogeneous settled
  member types while returning a fresh mutable result tuple.
- Source TSDoc, ADR-003, vocabulary, public contract, authored guide and packed
  consumer qualification describe and prove the same algebra.
- Generated API projection remains owned by P2-008.

## Verification

Run focused sync, async, throwing-getter, non-native thenable and mixed-join
tests; source and test typechecks; ESLint and formatting; coverage; build; and
packed Bundler/strict NodeNext qualification. Require an independent semantic
and public-surface review before handoff to P2-008.
