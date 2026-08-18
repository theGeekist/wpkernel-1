---
architecture_version: 1
id: P2-007
title: Integrate v2, the v1 adapter and consumers
stage: integration
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
    - P2-005
    - P2-006
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-003
    - P2-004
    - P2-005
    - P2-006
write_scope:
    - packages/pipeline/src/v2/index.ts
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

- V2 root exports contain no private runner types.
- Standard fragment and builder semantics are either explicit graph nodes or a
  named serial adapter. Mutable compatibility never enters the v2 scheduler.
- `next(output?)` exists only behind the v1 adapter, if retained at all.
- Current core, CLI and test-utils consumers compile and pass.

## Verification

Root-only consumer type tests, WPKernel dependent suites, v1 migration fixtures
and recorded external consumer evidence.

Suggested execution tier: balanced migration lanes with frontier integration
review.
