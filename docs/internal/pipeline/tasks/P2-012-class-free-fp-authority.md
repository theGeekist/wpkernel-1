---
architecture_version: 1
id: P2-012
title: Remove class syntax from the v2 functional core
stage: source
status: done
priority: critical
evidence_milestone: 'Class-free invariant Graph and Suspension authority qualified and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_012_class_free
owner_kind: null
lease_started_at: 2026-08-21T16:12:12Z
lease_expires_at: 2026-08-21T20:12:12Z
base_sha: 8dad995d
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-006
decision_dependencies:
    - ADR-001
    - ADR-002
conflicts_with:
    - P2-007
    - P2-008
    - P2-013
    - P2-014
write_scope:
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/scheduler/**
    - packages/pipeline/src/v2/suspension/**
    - packages/pipeline/src/v2/effects/**
    - packages/pipeline/src/v2/middleware/**
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/__tests__/graph/**
    - packages/pipeline/src/v2/__tests__/scheduler/**
    - packages/pipeline/src/v2/__tests__/suspension/**
    - packages/pipeline/src/v2/__tests__/effects/**
    - packages/pipeline/src/v2/__tests__/middleware/**
    - packages/pipeline/src/v2/__tests__/observers/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Preserve the frozen public type and failure semantics.
    - path: docs/internal/pipeline/decisions/ADR-001-explicit-dataflow-dag.md
      reason: Preserve compiled graph authority without object-oriented runtime state.
    - path: docs/internal/pipeline/decisions/ADR-002-process-local-host-boundary.md
      reason: Keep suspension authority process-local and privately owned.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/v2/**
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-012: Remove class syntax from the v2 functional core

## Objective

Make the v2 implementation consistently functional before TSDoc and public
export. Remove runtime and declaration-only class syntax without weakening
compiled-graph or suspension authority, typed public failures, synchronous
`MaybePromise` settlement, or runtime identity checks.

## Acceptance criteria

- No `class`, `declare class` or `extends Error` remains in v2 production code.
- Graph compilation and scheduler failures are created by explicit factories
  and retain immutable `name`, `message`, `code` or diagnostics, `cause`, and
  native `Error` behaviour.
- Graph and Suspension remain unconstructable public capabilities in ordinary
  TypeScript, with private runtime authority still enforced by module-owned
  weak collections.
- Literal, spread, cloned, deserialised, proxied and cross-capability forgeries
  are challenged explicitly. Any unavoidable TypeScript structural limitation
  is documented honestly rather than hidden behind a misleading phantom.
- Existing heterogeneous inference and exact public failure narrowing remain
  intact.
- No closure acquires durable or shared execution authority.
- All changed source and test files remain at or below 500 lines.
- Coverage does not regress and no coverage suppression is introduced.

## Verification

Focused runtime and compile-time authority fixtures, typed-error contract tests,
source and test typechecks, build/declaration emit, lint, formatting, diff check,
full package coverage, and independent adversarial review.

Suggested execution tier: frontier implementation.
