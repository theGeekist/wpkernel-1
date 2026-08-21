---
architecture_version: 1
id: P2-005
title: Implement the unified effect journal
stage: source
status: done
priority: critical
evidence_milestone: 'Unified process-local effect journal qualified and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_005_effect_journal
owner_kind: null
lease_started_at: 2026-08-21T13:38:31Z
lease_expires_at: 2026-08-21T17:38:31Z
base_sha: 690c4063c3467b5008cd2e478dc247a416104b91
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-003
    - P2-004
decision_dependencies:
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/graph/compiler.ts
    - packages/pipeline/src/v2/graph/executors.ts
    - packages/pipeline/src/v2/effects/**
    - packages/pipeline/src/v2/scheduler/**
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/__tests__/effects/**
    - packages/pipeline/src/v2/__tests__/scheduler/**
    - packages/pipeline/src/v2/__tests__/observers/**
    - packages/pipeline/src/v2/__tests__/middleware/types.test.ts
    - packages/pipeline/src/v2/__tests__/middleware/phases.test.ts
    - packages/pipeline/src/v2/__tests__/extensions/types.test.ts
    - packages/pipeline/src/v2/__tests__/extensions/registry.test.ts
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Preserve graph failure primacy and declared effect semantics.
    - path: docs/internal/pipeline/decisions/ADR-002-process-local-host-boundary.md
      reason: Avoid distributed transaction claims.
    - path: docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
      reason: Journal effects from nodes and middleware uniformly.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/core/rollback.ts
    - packages/pipeline/src/core/runner/rollback.ts
    - packages/pipeline/src/core/extensions/runner.ts
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/middleware/**
    - packages/pipeline/src/v2/scheduler/**
review_owner: coordinator
updated_at: 2026-08-18
---

# P2-005: Implement the unified effect journal

## Objective

Unify node and middleware effect preparation, commit and compensation without
claiming atomic external mutation.

## Acceptance criteria

- Successful preparation appends deterministic journal entries.
- Node and middleware requests prepare serially within one admitted node before
  the next middleware phase, while different nodes may prepare concurrently.
- The node evaluator remains the sole insertion seam for prepare work;
  readiness, capacity and dependant unlocking remain scheduler authority.
- Commit begins only after graph success and follows canonical graph order.
- Failure drains admitted nodes before reverse-chronology compensation.
- Original graph failure stays primary.
- Every compensation failure is retained and reported.
- Commit and compensation are exactly once per process-local run state.
- Participant declared failures, throws, hostile thenables and invalid results
  remain distinct and retained without rejecting the public run.
- Entirely synchronous participants preserve synchronous terminal settlement;
  only a callable thenable promotes the active phase.
- Observer delivery remains non-gating and receives immutable effect lifecycle
  events without gaining journal authority.

## Verification

Synchronous settlement, concurrent preparation chronology, commit failure,
multiple rollback failure, cancellation, abandonment boundary, hostile
thenables, exactly-once and observer containment tests.

Suggested execution tier: frontier reasoning and adversarial tests.
