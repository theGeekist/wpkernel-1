---
architecture_version: 1
id: P2-013
title: Author v2 TSDoc and public documentation
stage: source
status: done
priority: critical
evidence_milestone: 'Curated v2 surface, source TSDoc and authored public documentation independently reviewed clean'
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_013_tsdoc
owner_kind: null
lease_started_at: 2026-08-21T19:10:19Z
lease_expires_at: 2026-08-21T23:10:19Z
base_sha: d202c1ce
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-014
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with:
    - P2-007
    - P2-012
write_scope:
    - packages/pipeline/src/v2/**/*.ts
    - packages/pipeline/src/v2/index.ts
    - packages/pipeline/README.md
    - docs/packages/pipeline.md
    - docs/packages/pipeline/**
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Document the implemented contract without widening it.
    - path: docs/internal/pipeline/contracts/v2-vocabulary.md
      reason: Preserve one public vocabulary.
    - path: instructions/wpkernel-repository-guide.md
      reason: Keep generated API output separate from authored source.
read_scope:
    - docs/internal/pipeline/**
    - instructions/wpkernel-repository-guide.md
    - packages/pipeline/src/v1/**
    - packages/pipeline/src/v2/**
    - packages/pipeline/README.md
    - docs/packages/pipeline/**
    - scripts/docs/**
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-013: Author v2 TSDoc and public documentation

## Objective

Finish the public contract in source and authored prose before v2 is exposed at
the package root. Preserve Pipeline's existing voice rather than replacing it
with generic framework documentation.

## Acceptance criteria

- Every intended public v2 symbol has current source TSDoc before root export.
- `packages/pipeline/src/v2/index.ts` defines the reviewed intended surface
  while it remains unreachable from the package root; P2-007 only integrates
  that surface.
- Authored docs explain graph dataflow, concurrency, middleware, effects,
  process-local suspension and host durability boundaries.
- A v1 migration guide names every breaking semantic change.
- Examples are concrete and typed against the pre-export v2 barrel while
  authored prose uses the future `@wpkernel/pipeline` root import rather than a
  private source path.
- The register matches v1: direct claims, precise limits, dry wit where it
  belongs, and no framework theatre or generic AI prose.
- Generated API Markdown is not edited. P2-008 owns regeneration only after
  P2-007 integrates the reviewed root surface.
- Documentation does not imply durable restart, exactly-once external effects,
  hostile multi-process authority or settlement-order semantics.

## Verification

Source TSDoc completeness audit, example typechecks, authored-site build and an
independent technical accuracy plus voice review with fix-and-re-review until
clean.

Suggested execution tier: high-creativity technical writer followed by
frontier contract review.
