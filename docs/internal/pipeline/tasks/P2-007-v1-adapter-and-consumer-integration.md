---
architecture_version: 1
id: P2-007
title: Integrate v2, the v1 adapter and consumers
stage: integration
status: in_progress
priority: critical
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: codex-root
owner_kind: codex
lease_started_at: 2026-08-22T04:30:00+08:00
lease_expires_at: 2026-08-22T12:30:00+08:00
base_sha: 618f9d22
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-005
    - P2-006
    - P2-013
    - P2-015
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-003
    - P2-004
    - P2-005
    - P2-006
    - P2-013
    - P2-015
write_scope:
    - packages/pipeline/src/index.ts
    - packages/pipeline/src/standard-pipeline/**
    - packages/core/src/pipeline/**
    - packages/cli/src/runtime/**
    - packages/test-utils/src/core/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Integrate only the admitted root contract.
    - path: docs/internal/pipeline/contracts/v2-vocabulary.md
      reason: Keep migration names consistent.
    - path: docs/internal/pipeline/ROADMAP.md
      reason: Preserve Task Graph and llm-core release sequencing.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/**
    - packages/core/src/pipeline/**
    - packages/cli/src/runtime/**
    - packages/test-utils/src/core/**
review_owner: coordinator
updated_at: 2026-08-19
---

# P2-007: Integrate v2, the v1 adapter and consumers

## Objective

Expose one coherent v2 root contract, retain v1 only through an explicitly
serial compatibility boundary, and migrate real WPKernel consumers.

## Acceptance criteria

- The reviewed P2-013 v2 surface is exposed from the package root without
  private runner types.
- Standard fragment and builder semantics are either explicit graph nodes or a
  named serial adapter. Mutable compatibility never enters the v2 scheduler.
- `next(output?)` exists only behind the v1 adapter, if retained at all.
- Current core, CLI and test-utils consumers compile and pass.
- Compatibility and consumer composition preserve synchronous settlement until
  real asynchronous work appears; no unconditional `async` wrapper is admitted.
- Runtime implementation files remain class-free and are split at roughly 500
  lines where a coherent seam exists.
- Focused and repository coverage do not regress, and each migration lane is
  independently reviewed before integration.

## Verification

Root-only consumer type tests, WPKernel dependent suites, v1 migration fixtures
and recorded external consumer evidence.

Suggested execution tier: balanced migration lanes with frontier integration
review.
