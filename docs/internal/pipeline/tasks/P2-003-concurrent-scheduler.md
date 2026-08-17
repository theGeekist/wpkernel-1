---
architecture_version: 1
id: P2-003
title: Implement the immutable concurrent scheduler
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
    - P2-002
decision_dependencies:
    - ADR-001
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/scheduler/**
    - packages/pipeline/src/v2/__tests__/scheduler/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Preserve sync settlement, failure and cancellation semantics.
    - path: docs/internal/pipeline/decisions/ADR-001-explicit-dataflow-dag.md
      reason: Schedule from graph readiness without timing-dependent meaning.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/core/execution-utils.ts
    - packages/pipeline/src/core/runner/execution.ts
review_owner: coordinator
updated_at: 2026-08-18
---

# P2-003: Implement the immutable concurrent scheduler

## Objective

Execute ready nodes concurrently from graph state while preserving synchronous
settlement and deterministic semantics.

## Acceptance criteria

- Dynamic readiness, fan-out and fan-in execute without wave barriers.
- Optional bounded concurrency has deterministic admission.
- Settlement timing never changes input values or primary failure selection.
- Failure stops new admission, drains admitted work and preserves sibling
  failures.
- Cancellation propagates through one `AbortSignal` contract.
- An entirely synchronous graph returns synchronously.
- Concurrent nodes cannot observe shared mutable graph data.

## Verification

Deterministic fake-scheduler tests, controlled promise tests, sync return
assertions, concurrency bounds, failure fan-out and race-focused repetition.

Suggested execution tier: frontier implementation and independent adversarial
review.
