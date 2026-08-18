---
architecture_version: 1
id: P2-008
title: Publish the v2 contract through TSDoc and authored documentation
stage: qualification
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
    - P2-007
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-009
write_scope:
    - packages/pipeline/src/**/*.ts
    - packages/pipeline/README.md
    - docs/packages/pipeline.md
    - docs/packages/pipeline/**
    - docs/api/@wpkernel/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Document the implemented contract without widening it.
    - path: docs/internal/pipeline/contracts/v2-vocabulary.md
      reason: Preserve one public vocabulary.
    - path: instructions/wpkernel-repository-guide.md
      reason: Follow the generated API and route verification workflow.
read_scope:
    - docs/internal/pipeline/**
    - instructions/wpkernel-repository-guide.md
    - packages/pipeline/src/**
    - packages/pipeline/README.md
    - docs/packages/pipeline/**
    - scripts/docs/**
review_owner: coordinator
updated_at: 2026-08-19
---

# P2-008: Publish the v2 contract through TSDoc and authored documentation

## Objective

Make the implemented v2 contract legible without letting generated API output
become the authoring surface.

## Acceptance criteria

- Every public v2 symbol has current source TSDoc and runnable examples.
- Authored docs explain graph dataflow, concurrency, middleware, effects,
  process-local suspension and host durability boundaries.
- A v1 migration guide names every breaking semantic change.
- The prose retains Pipeline's voice: direct claims, concrete typed examples,
  explicit limits and no framework theatre.
- Source TSDoc and authored pages are the authoring surfaces. The coordinator
  regenerates the complete `docs/api/@wpkernel` projection; it is never
  hand-edited or partially regenerated.
- Site output contains the authored `/packages/pipeline.html` page and the
  generated `/api/@wpkernel/pipeline/README.html` package landing page.

## Verification

`pnpm docs:api`, `pnpm docs:site`, route existence checks, example typechecks
and an independent voice/accuracy review.

Suggested execution tier: fast projection after a balanced technical draft,
then author review.
