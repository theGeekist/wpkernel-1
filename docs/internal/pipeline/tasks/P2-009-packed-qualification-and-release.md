---
architecture_version: 1
id: P2-009
title: Qualify and release Pipeline 2.0.0
stage: release
status: active
priority: critical
evidence_milestone: null
replaced_by: []
forward_to: []
preferred_owner_kind: codex
owner: /root/p2_009_release
owner_kind: codex
lease_started_at: 2026-08-22T13:46:14+08:00
lease_expires_at: 2026-08-22T17:46:14+08:00
base_sha: a6b74e063d7a462c10b787ef7191b827347abffd
branch: main
worktree: /Users/jasonnathan/Repos/wpkernel
depends_on:
    - P2-008
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with: []
write_scope:
    - docs/internal/pipeline/tasks/P2-009-packed-qualification-and-release.md
    - docs/api/@wpkernel/**
    - docs/packages/pipeline.md
    - docs/packages/pipeline/**
    - packages/pipeline/package.json
    - packages/pipeline/CHANGELOG.md
    - packages/pipeline/tsconfig.json
    - packages/pipeline/scripts/**
    - packages/pipeline/src/v2/__tests__/pipeline/types.test.ts
    - packages/pipeline/src/v2/middleware/types.ts
    - packages/pipeline/src/v2/pipeline/runtime.ts
    - packages/pipeline/src/v2/pipeline/types.ts
    - package.json
    - scripts/docs/typedoc-public-surface.mjs
    - scripts/release/release-pipeline.ts
    - scripts/release/pipeline-release-metadata.*
    - tests/__tests__/scripts/typedoc-public-surface.test.ts
    - tests/__tests__/resolution/workspace-installed-resolution.test.ts
    - .github/workflows/publish-pipeline.yml
    - pnpm-lock.yaml
required_reading:
    - path: docs/internal/pipeline/contracts/v2-public-contract.md
      reason: Qualify the accepted public and runtime contract.
    - path: docs/internal/pipeline/ROADMAP.md
      reason: Preserve release and downstream sequencing.
    - path: instructions/wpkernel-repository-guide.md
      reason: Use origin for contribution and upstream for the trusted release tag.
read_scope:
    - docs/internal/pipeline/**
    - docs/packages/pipeline.md
    - docs/packages/pipeline/**
    - instructions/wpkernel-repository-guide.md
    - packages/pipeline/**
    - scripts/docs/typedoc-public-surface.mjs
    - scripts/release/release-pipeline.ts
    - scripts/release/pipeline-release-metadata.*
    - tests/__tests__/scripts/typedoc-public-surface.test.ts
    - tests/__tests__/resolution/workspace-installed-resolution.test.ts
    - .github/workflows/publish-pipeline.yml
    - package.json
    - pnpm-lock.yaml
review_owner: coordinator
updated_at: 2026-08-22
---

# P2-009: Qualify and release Pipeline 2.0.0

## Objective

Qualify one exact packed archive and release it through the trusted major
version workflow.

## Acceptance criteria

- Clean frozen install, lint, source/test typechecks, coverage and build pass.
- The archive is packed once and that same file is used for every consumer and
  publication gate.
- Clean Bundler and strict NodeNext consumers compile from root imports.
- Runtime qualification covers fan-out, fan-in, bounded concurrency,
  synchronous settlement, middleware, effects, cancellation and migration.
- The packed qualifier is split by responsibility so no implementation file
  exceeds the programme's approximate 500-line budget.
- Negative type assertions reject private imports and invalid graph contracts.
- Tag and manifest version agree.
- After the 2.0.0 manifest bump, the complete generated API projection is
  regenerated, reviewed and labelled 2.0.0; both authored and generated
  Pipeline site routes exist.
- Prereleases publish to `beta`; final 2.0.0 publishes to `latest`.
- Contributors push release branches to `origin` and merge through an upstream
  pull request.
- The current approved upstream release authority, `pipewrk`, creates
  `pipeline-v<version>` at the merged upstream commit without bypassing the
  direct-push guard. The trusted workflow rejects every other tag-push actor;
  this fail-closed admission does not imply that GitHub tag protection exists.
- Only the trusted upstream workflow packs, qualifies and publishes the archive.
- The release helper becomes prepare-and-qualify only, or delegates to the
  approved release authority. It never instructs `git push upstream <tag>` or
  manual `pnpm publish`.
- Fork publication remains disabled; the fork documentation workflow has no
  automatic schedule.

## Verification

Record exact archive SHA-512, SHA-1 shasum and SRI, packed contents, consumer
lock binding, commands, generated API and site routes, workflow run, registry
integrity and downstream adoption evidence.

Suggested execution tier: balanced release execution with frontier audit.
