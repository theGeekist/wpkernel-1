---
architecture_version: 1
id: P2-009
title: Qualify and release Pipeline 2.0.0
stage: release
status: proposed
priority: critical
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
    - P2-008
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with: []
write_scope:
    - packages/pipeline/package.json
    - packages/pipeline/CHANGELOG.md
    - packages/pipeline/scripts/**
    - scripts/release/release-pipeline.ts
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
    - instructions/wpkernel-repository-guide.md
    - packages/pipeline/**
    - scripts/release/release-pipeline.ts
    - .github/workflows/publish-pipeline.yml
    - package.json
    - pnpm-lock.yaml
review_owner: coordinator
updated_at: 2026-08-19
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
- Negative type assertions reject private imports and invalid graph contracts.
- Tag and manifest version agree.
- Prereleases publish to `beta`; final 2.0.0 publishes to `latest`.
- Contributors push release branches to `origin` and merge through an upstream
  pull request.
- The approved upstream release authority creates `pipeline-v<version>` at the
  merged upstream commit without bypassing the direct-push guard.
- Only the trusted upstream workflow packs, qualifies and publishes the archive.
- The release helper becomes prepare-and-qualify only, or delegates to the
  approved release authority. It never instructs `git push upstream <tag>` or
  manual `pnpm publish`.
- Fork publication remains disabled; the fork documentation workflow has no
  automatic schedule.

## Verification

Record exact archive SHA-512, packed contents, consumer lock binding, commands,
workflow run, registry integrity and downstream adoption evidence.

Suggested execution tier: balanced release execution with frontier audit.
