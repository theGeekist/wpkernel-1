---
architecture_version: 1
id: P2-006
title: Define graph-frontier suspension and concurrent diagnostics
stage: source
status: done
priority: critical
evidence_milestone: 'Process-local frontier suspension and concurrent diagnostics qualified and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_006_suspension
owner_kind: null
lease_started_at: 2026-08-21T15:04:31Z
lease_expires_at: 2026-08-21T19:04:31Z
base_sha: 7b17369bf3f790088fd897a1b42ee9beb11f6994
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-003
    - P2-004
    - P2-005
decision_dependencies:
    - ADR-001
    - ADR-002
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/suspension/**
    - packages/pipeline/src/v2/diagnostics/**
    - packages/pipeline/src/v2/scheduler/**
    - packages/pipeline/src/v2/effects/**
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/__tests__/suspension/**
    - packages/pipeline/src/v2/__tests__/diagnostics/**
    - packages/pipeline/src/v2/__tests__/scheduler/**
    - packages/pipeline/src/v2/__tests__/effects/**
    - packages/pipeline/src/v2/__tests__/observers/**
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
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/middleware/**
    - packages/pipeline/src/v2/effects/**
    - packages/pipeline/src/v2/scheduler/**
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
- Resume consumes suspension authority exactly once and continues with the
  captured configuration, frontier, outputs and prepared journal.
- Abandon consumes suspension authority exactly once and performs
  non-cancellable reverse-journal compensation, retaining every cleanup
  failure.
- Multiple concurrent pauses fail deterministically.
- Final node records have canonical graph order plus admission and settlement
  sequence.
- Streaming events document that concurrent chronology is timing-dependent.
- Sibling failures and dissent remain visible.
- Entirely synchronous pause, resume or abandon work remains synchronous until
  a callable participant or observer thenable promotes the active phase.

## Verification

Pause races, resume replay, single-use enforcement, trace ordering and
concurrent diagnostic isolation tests.

Suggested execution tier: frontier implementation.
