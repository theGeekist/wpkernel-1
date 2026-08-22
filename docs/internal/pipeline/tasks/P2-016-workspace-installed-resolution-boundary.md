---
architecture_version: 1
id: P2-016
title: Separate workspace source and installed package resolution
stage: qualification
status: proposed
priority: normal
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
decision_dependencies: []
conflicts_with: []
write_scope:
    - tsconfig.base.json
    - tsconfig.lib.json
    - tsconfig.tests.json
    - packages/*/tsconfig*.json
    - tests/fixtures/installed-consumers/**
    - tests/__tests__/resolution/**
required_reading:
    - path: instructions/wpkernel-repository-guide.md
      reason: Preserve workspace builds and packed-consumer qualification.
    - path: docs/internal/pipeline/EXTERNAL-LANES.md
      reason: Keep installed dependency resolution distinct from workspace tooling.
read_scope:
    - instructions/wpkernel-repository-guide.md
    - tsconfig*.json
    - packages/*/tsconfig*.json
    - package.json
    - pnpm-lock.yaml
    - docs/internal/pipeline/**
    - tests/**
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-016: Separate workspace source and installed package resolution

## Objective

Keep intentional first-party source development mapped to WPKernel packages
without allowing those mappings to replace dependency versions requested by
installed or transitive consumers.

## Evidence

- Published Task Graph beta.2 plans WPKernel's real manifest when installed
  outside the WPKernel source-mapping boundary.
- The same raw TypeScript CLI fails beneath WPKernel because Bun redirects its
  canonical Pipeline import to `packages/pipeline/src/index.ts`.
- A compiled Task Graph CLI retaining exact Pipeline 1.4.1 works from the
  WPKernel directory because no runtime package import remains to redirect.
- Importing Task Graph's public `TaskPlanConfiguration` under WPKernel's root
  paths redirects its `HelperMode` declaration to local v2 and reports TS2305.

## Acceptance criteria

- First-party WPKernel package development still resolves intentional local
  Pipeline source or declarations.
- An installed consumer's canonical `@wpkernel/pipeline` import resolves the
  version selected by its own dependency graph.
- Runtime and strict NodeNext fixtures prove both contexts without npm aliases,
  dependency overrides or `skipLibCheck`.
- Existing package source/test typechecks and packed qualification do not
  regress.
- The chosen boundary is documented as workspace development versus installed
  consumer resolution, not as a Task Graph exception.

## Verification

Use one first-party workspace fixture and one clean installed-consumer fixture,
then run affected package source/test typechecks and strict NodeNext declaration
qualification.

Suggested execution tier: balanced tooling implementation with independent
resolution review.
