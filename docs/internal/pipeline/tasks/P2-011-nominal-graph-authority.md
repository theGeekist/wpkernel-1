---
id: p2-011
title: Make compiled Graph authority nominal
stage: source
status: done
priority: critical
evidence_milestone: 'Nominal compiled Graph authority qualified in strict NodeNext and independently reviewed clean'
forward_to: []
depends_on:
    - p2-002
    - p2-003
decision_dependencies:
    - ADR-001
conflicts_with:
    - p2-007
write_scope:
    - packages/pipeline/src/v2/graph/types.ts
    - packages/pipeline/src/v2/graph/topology.ts
    - packages/pipeline/src/v2/__tests__/graph/compile.test.ts
    - packages/pipeline/src/v2/__tests__/scheduler/contract-boundaries.test.ts
    - packages/pipeline/src/v2/__tests__/scheduler/types.test.ts
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Preserve compiled graph authority and every public generic relationship.
    - path: docs/internal/pipeline/decisions/ADR-001-explicit-dataflow-dag.md
      reason: Keep the compiled graph as the sole execution authority.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/scheduler/**
review_owner: coordinator
updated_at: 2026-08-21
---

# P2-011: Make compiled Graph authority nominal

## Objective

Ensure only a successfully compiled graph satisfies the public `Graph` type
without weakening the private executor authority or heterogeneous inference.

## Acceptance criteria

- Plain object literals cannot satisfy `Graph` without an explicit assertion.
- Spreads or reconstructed/deserialised graph projections cannot silently regain
  compiled authority.
- Genuine compiled graphs retain exact inputs, capabilities, outputs, node
  outputs and declared failure types through `scheduleGraph` inference.
- Runtime executor ownership remains private and keyed by compiled graph identity.
- The correction adds no public constructor or serialisable authority claim.

## Verification

Source and test type fixtures, focused graph/scheduler tests, package build,
typechecks, lint, formatting and independent adversarial review.

Suggested execution tier: balanced implementation with frontier type review.
