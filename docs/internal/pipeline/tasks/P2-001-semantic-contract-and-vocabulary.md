---
id: p2-001
title: Freeze v2 semantics and public vocabulary
stage: contract
status: done
priority: critical
evidence_milestone: 'Accepted contract and clean independent review'
forward_to: []
depends_on: []
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with: []
write_scope:
    - docs/internal/pipeline/contracts/v2-public-contract.md
    - docs/internal/pipeline/contracts/v2-vocabulary.md
required_reading:
    - path: docs/internal/pipeline/README.md
      reason: Preserve the accepted v2 semantic and host boundaries.
    - path: docs/internal/pipeline/decisions/ADR-001-explicit-dataflow-dag.md
      reason: Treat the compiled graph as the execution authority.
    - path: docs/internal/pipeline/decisions/ADR-002-process-local-host-boundary.md
      reason: Keep durability and external-effect authority in the host.
    - path: docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
      reason: Preserve the four explicit extension roles.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/index.ts
    - packages/pipeline/src/core/types.ts
review_owner: coordinator
updated_at: 2026-08-21
---

# P2-001: Freeze v2 semantics and public vocabulary

## Objective

Produce the versioned public semantic contract and vocabulary before runtime
implementation chooses names accidentally.

## In scope

- Node, edge, input, output, graph, run, effect, observer and middleware nouns.
- Generic parameter and function shapes, including options objects instead of
  wide positional argument lists.
- A closure audit. Public factories and callbacks require a reason to exist;
  hidden continuation closures are not a default composition technique.
- Sync settlement, failure, cancellation, pause and trace terminology.
- Disposition of `Helper`, `Stage`, `next`, `Extension` and Standard Pipeline
  vocabulary as retained, adapted, renamed or removed.

## Acceptance criteria

- Every public v2 noun has one meaning and one owning layer.
- The contract distinguishes graph data, capabilities and external effects.
- Unresolved API choices are explicit rather than embedded in examples.
- A v1-to-v2 vocabulary table exists.

## Verification

Peer architecture review against all three ADRs and current root exports.

Suggested execution tier: frontier reasoning, then an independent vocabulary
review.
