---
architecture_version: 1
id: P2-014
title: Implement and freeze the v2 public evaluator surface
stage: source
status: done
priority: critical
evidence_milestone: 'Functional Pipeline evaluator and exact public outcome surface qualified and independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_014_public_surface
owner_kind: null
lease_started_at: 2026-08-21T16:47:35Z
lease_expires_at: 2026-08-21T20:47:35Z
base_sha: c4e047c0
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-012
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-007
    - P2-013
write_scope:
    - docs/internal/pipeline/contracts/**
    - docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
    - packages/pipeline/src/v2/pipeline/**
    - packages/pipeline/src/v2/graph/**
    - packages/pipeline/src/v2/extensions/**
    - packages/pipeline/src/v2/middleware/**
    - packages/pipeline/src/v2/effects/**
    - packages/pipeline/src/v2/scheduler/**
    - packages/pipeline/src/v2/suspension/**
    - packages/pipeline/src/v2/diagnostics/**
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/__tests__/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Converge the implemented evaluator with the accepted semantics.
    - path: docs/internal/pipeline/contracts/v2-vocabulary.md
      reason: Make every intended public noun concrete before TSDoc.
    - path: docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
      reason: Preserve role separation and atomic configuration capture.
read_scope:
    - docs/internal/pipeline/**
    - packages/pipeline/src/v2/**
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-014: Implement and freeze the v2 public evaluator surface

## Objective

Provide the missing functional `Pipeline` evaluator over the existing compiler,
extension, scheduler, effect and suspension seams. Freeze the final public
vocabulary before source TSDoc or package-root integration.

## Acceptance criteria

- `createPipeline` creates one immutable, process-local `Pipeline` evaluator.
- One public run operation atomically captures the base declaration, extension
  generation, middleware, observers and effect participants before compilation
  and evaluation.
- Configuration and compilation failures are one explicit algebraic public
  result retaining every extension failure and graph diagnostic.
- `scheduleGraph`, extension-registry mutation, interpreter compilers and
  journal settlement remain internal seams rather than alternate public
  lifecycle authorities.
- Public outcomes use the accepted nouns `NodeOutcome`, `PauseRequest`,
  `EffectRequest` and a named located pause record. Scheduler-only `pending*`
  collections do not leak through terminal `RunOutcome`.
- Middleware eligibility is frozen as exact static node-key eligibility unless
  a separately justified tag model is implemented. The contract and ADR say
  exactly what the source does.
- Contribution, anchor and diagnostic names and ownership are resolved in the
  accepted contract before documentation.
- `packages/pipeline/src/v2/index.ts` can be hand-curated by P2-013 without
  exporting erased types, mutable interpreter helpers or error factories.
- No class syntax, hidden mutable closure cell, graph continuation or second
  execution authority is introduced. Any proposed method-shaped API receives
  an explicit design checkpoint before implementation.
- Entirely synchronous configuration, compilation, evaluation and observer
  work remains synchronous until one real callable thenable promotes it.
- All changed source and test files remain at or below 500 lines. Coverage does
  not regress and no coverage suppression is introduced.

## Verification

Public-surface type fixtures, exact generation-capture races, synchronous and
thenable promotion tests, terminal projection tests, source/test typechecks,
build/declaration emit, lint, formatting, diff check, full package coverage and
independent contract/API review.

Suggested execution tier: frontier implementation.
