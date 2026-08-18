---
architecture_version: 1
id: P2-006
title: Define graph-frontier suspension and concurrent diagnostics
stage: source
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
    - P2-003
    - P2-004
decision_dependencies:
    - ADR-001
    - ADR-002
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/suspension/**
    - packages/pipeline/src/v2/diagnostics/**
    - packages/pipeline/src/v2/__tests__/suspension/**
    - packages/pipeline/src/v2/__tests__/diagnostics/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Implement admitted pause, resume and trace semantics.
    - path: docs/internal/pipeline/decisions/ADR-001-explicit-dataflow-dag.md
      reason: Represent graph frontier rather than stage index.
    - path: docs/internal/pipeline/decisions/ADR-002-process-local-host-boundary.md
      reason: Keep suspension process-local and single-use.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/core/makeResumablePipeline.ts
    - packages/pipeline/src/core/runner/program.ts
    - packages/pipeline/src/core/runner/diagnostics.ts
review_owner: coordinator
updated_at: 2026-08-19
---

# P2-006: Define graph-frontier suspension and concurrent diagnostics

## Objective

Replace sequential stage-index suspension and total-order steps with a
process-local graph frontier and honest concurrent traces.

## Acceptance criteria

- Pause stops admission and drains in-flight work before settling.
- The private frontier records plan identity, completed outputs, pending,
  blocked and effect state without becoming serialisable public authority.
- Resume does not replay completed nodes.
- Multiple concurrent pauses fail deterministically.
- Final node records have canonical graph order plus admission and settlement
  sequence.
- Streaming events document that concurrent chronology is timing-dependent.
- Sibling failures and dissent remain visible.

## Verification

Pause races, resume replay, single-use enforcement, trace ordering and
concurrent diagnostic isolation tests.

Suggested execution tier: frontier implementation.
