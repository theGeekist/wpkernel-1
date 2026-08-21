---
architecture_version: 1
id: P2-004
title: Extract node evaluation and compile middleware into explicit roles
stage: source
status: done
priority: critical
evidence_milestone: 'Node evaluation, middleware, observers and typed extension generations qualified and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_004_node_interpreter
owner_kind: null
lease_started_at: 2026-08-21T11:41:26Z
lease_expires_at: 2026-08-21T14:41:26Z
base_sha: ca274a0824162df465e1884a6e74e763c06b7e09
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-001
    - P2-002
    - P2-003
    - P2-011
decision_dependencies:
    - ADR-003
conflicts_with:
    - P2-007
write_scope:
    - packages/pipeline/src/v2/scheduler/**
    - packages/pipeline/src/v2/extensions/**
    - packages/pipeline/src/v2/middleware/**
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/__tests__/scheduler/**
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
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/scheduler/**
review_owner: coordinator
updated_at: 2026-08-19
---

# P2-004: Extract node evaluation and compile middleware into explicit roles

## Objective

Extract one explicit node-evaluation interpreter from scheduler readiness,
consolidate per-node runtime authority, then replace hidden lifecycle execution
with inspectable graph contributions, single-node middleware and read-only
observers.

## Acceptance criteria

- Graph extensions contribute nodes and edges before compilation.
- Readiness, capacity and dependant unlocking remain scheduler concerns while one
  internal `MaybePromise<NodeEvaluation>` seam owns node interpretation.
- One discriminated `NodeRuntimeState` per node replaces correlated status,
  output, outcome, failure, effect and pause maps.
- Middleware wraps one node only and cannot execute the graph suffix.
- Middleware phases compose through explicit values rather than public
  continuation closures or mutable closure cells.
- Middleware effect requests use the same immutable evaluation handoff as node
  effect requests. Preparation, commit and compensation remain P2-005
  authority.
- Observers cannot mutate graph values or affect admission.
- Registration call order, async quiescence and run snapshots remain stable.
- Lifecycle anchors compile into the graph.
- No public continuation closure is required.

## Verification

Node-state transition, synchronous settlement, readiness isolation,
registration ordering, async setup, middleware phase ordering, effect-request
handoff, observer failure containment and graph-inspection tests.

Suggested execution tier: frontier contract implementation.
