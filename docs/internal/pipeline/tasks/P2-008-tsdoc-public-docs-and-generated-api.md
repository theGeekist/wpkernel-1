---
architecture_version: 1
id: P2-008
title: Generate and verify the v2 API documentation projection
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

# P2-008: Generate and verify the v2 API documentation projection

## Objective

Regenerate and verify the API projection from the already reviewed source
TSDoc after root integration. Generated output never becomes an authoring
surface.

## Acceptance criteria

- P2-013 source TSDoc and authored documentation remain the sole authoring
  surfaces.
- The coordinator regenerates the complete `docs/api/@wpkernel` projection; it
  is never hand-edited or partially regenerated.
- Every integrated public v2 symbol appears in the generated Pipeline API.
- Site output contains the authored `/packages/pipeline.html` page and the
  generated `/api/@wpkernel/pipeline/README.html` package landing page.

## Verification

`pnpm docs:api`, clean generated diff inspection, `pnpm docs:site`, route
existence checks and API-surface completeness review.

Suggested execution tier: fast mechanical projection with independent
completeness review.
