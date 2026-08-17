---
architecture_version: 1
id: P2-005
title: Implement the unified effect journal
stage: source
status: proposed
priority: critical
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
    - P2-003
    - P2-004
decision_dependencies:
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/effects/**
    - packages/pipeline/src/v2/__tests__/effects/**
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
review_owner: coordinator
updated_at: 2026-08-18
---

# P2-005: Implement the unified effect journal

## Objective

Unify node and middleware effect preparation, commit and compensation without
claiming atomic external mutation.

## Acceptance criteria

- Successful preparation appends deterministic journal entries.
- Commit begins only after graph success and follows canonical graph order.
- Failure drains admitted nodes before reverse-chronology compensation.
- Original graph failure stays primary.
- Every compensation failure is retained and reported.
- Commit and compensation are exactly once per process-local run state.

## Verification

Concurrent settlement chronology, commit failure, multiple rollback failure,
cancellation and observer containment tests.

Suggested execution tier: frontier reasoning and adversarial tests.
