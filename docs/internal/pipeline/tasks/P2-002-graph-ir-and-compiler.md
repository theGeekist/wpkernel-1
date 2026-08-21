---
architecture_version: 1
id: P2-002
title: Build the immutable graph IR and compiler
stage: source
status: done
priority: critical
evidence_milestone: 'Immutable graph compiler qualified and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_002_graph
owner_kind: null
lease_started_at: 2026-08-21T03:40:07Z
lease_expires_at: 2026-08-21T05:40:07Z
base_sha: a4d1ed3b6d38e27fac0c1278d392e8d38bdcfa7b
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-001
decision_dependencies:
    - ADR-001
conflicts_with: []
write_scope:
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/__tests__/graph/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Implement the admitted dataflow contract rather than a shadow model.
    - path: docs/internal/pipeline/decisions/ADR-001-explicit-dataflow-dag.md
      reason: Preserve graph authority, keyed fan-in and canonical rank.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/core/dependency-graph.ts
    - packages/pipeline/src/core/types.ts
review_owner: coordinator
updated_at: 2026-08-21
---

# P2-002: Build the immutable graph IR and compiler

## Objective

Compile declarations into the executable graph authority without reducing it
to a total order.

## Acceptance criteria

- Unique IDs, typed dependency ports, sources, dependants and canonical ranks.
- Duplicate IDs, missing dependencies, cycles and invalid anchors fail with
  typed diagnostics.
- Fan-in remains keyed and explicit.
- Compilation output is immutable and contains no consumer runtime values.
- Property tests cover arbitrary acyclic graphs and cycle rejection.

## Verification

Focused source/test typechecks, graph tests, property tests and deterministic
serialisation snapshots.

Suggested execution tier: balanced implementation with frontier review.
