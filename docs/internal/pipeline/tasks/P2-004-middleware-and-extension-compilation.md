---
architecture_version: 1
id: P2-004
title: Compile middleware and extensions into explicit roles
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
    - P2-001
decision_dependencies:
    - ADR-003
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/extensions/**
    - packages/pipeline/src/v2/middleware/**
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/__tests__/extensions/**
    - packages/pipeline/src/v2/__tests__/middleware/**
    - packages/pipeline/src/v2/__tests__/observers/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Implement only admitted middleware and extension semantics.
    - path: docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
      reason: Keep graph contributions, middleware, observers and effects distinct.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/core/createExtension.ts
    - packages/pipeline/src/core/extensions/**
review_owner: coordinator
updated_at: 2026-08-19
---

# P2-004: Compile middleware and extensions into explicit roles

## Objective

Replace hidden lifecycle execution with inspectable graph contributions,
single-node middleware and read-only observers.

## Acceptance criteria

- Graph extensions contribute nodes and edges before compilation.
- Middleware wraps one node only and cannot execute the graph suffix.
- Observers cannot mutate graph values or affect admission.
- Registration call order, async quiescence and run snapshots remain stable.
- Lifecycle anchors compile into the graph.
- No public continuation closure is required.

## Verification

Registration ordering, async setup, middleware phase ordering, observer failure
containment and graph-inspection tests.

Suggested execution tier: frontier contract implementation.
