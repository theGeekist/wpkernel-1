---
id: p2-009
title: Qualify and release Pipeline 2.0.0
stage: release
status: done
priority: critical
evidence_milestone: 'Pipeline 2.0.0 published through trusted OIDC workflow 32561994256; Node 20, 22.20.0 and 24 qualification, registry identity and live documentation verified'
forward_to: []
depends_on:
    - p2-008
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with: []
write_scope:
    - .gitignore
    - .taskgraph/project.json
    - typedoc.json
    - docs/internal/pipeline/tasks/P2-009-packed-qualification-and-release.md
    - docs/internal/pipeline/ROADMAP.md
    - docs/internal/pipeline/EXTERNAL-LANES.md
    - docs/internal/pipeline/tasks/P2-007-v1-adapter-and-consumer-integration.md
    - docs/internal/pipeline/tasks/P2-016-workspace-installed-resolution-boundary.md
    - docs/internal/pipeline/tasks/P2-017-authority-free-graph-inspection.md
    - docs/internal/php-json-ast/**
    - docs/api/@wpkernel/**
    - docs/packages/php-json-ast.md
    - docs/packages/pipeline.md
    - docs/packages/pipeline/**
    - packages/pipeline/package.json
    - packages/pipeline/CHANGELOG.md
    - packages/pipeline/tsconfig.json
    - packages/pipeline/scripts/**
    - packages/pipeline/src/standard-pipeline/runner/index.ts
    - packages/pipeline/src/standard-pipeline/__tests__/runner.coverage.test.ts
    - packages/pipeline/src/v2/__tests__/pipeline/types.test.ts
    - packages/pipeline/src/v2/__tests__/effects/settlement-boundaries.test.ts
    - packages/pipeline/src/v2/__tests__/observers/delivery.test.ts
    - packages/pipeline/src/v2/diagnostics/project.ts
    - packages/pipeline/src/v2/effects/runtime.ts
    - packages/pipeline/src/v2/effects/settlement.ts
    - packages/pipeline/src/v2/effects/types.ts
    - packages/pipeline/src/v2/middleware/types.ts
    - packages/pipeline/src/v2/observers/**
    - packages/pipeline/src/v2/pipeline/runtime.ts
    - packages/pipeline/src/v2/pipeline/types.ts
    - packages/pipeline/src/v2/scheduler/engine.ts
    - packages/pipeline/src/v2/scheduler/schedule.ts
    - packages/pipeline/src/v2/scheduler/state.ts
    - packages/pipeline/src/v2/suspension/authority.ts
    - packages/pipeline/src/v2/suspension/runtime.ts
    - package.json
    - scripts/docs/typedoc-public-surface.mjs
    - scripts/release/release-pipeline.ts
    - scripts/release/pipeline-release-metadata.*
    - scripts/workflow/prepare-upstream-pr.sh
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
    - .gitignore
    - .taskgraph/project.json
    - typedoc.json
    - docs/internal/pipeline/**
    - docs/internal/php-json-ast/**
    - docs/packages/php-json-ast.md
    - docs/packages/pipeline.md
    - docs/packages/pipeline/**
    - instructions/wpkernel-repository-guide.md
    - packages/pipeline/**
    - scripts/docs/typedoc-public-surface.mjs
    - scripts/release/release-pipeline.ts
    - scripts/release/pipeline-release-metadata.*
    - scripts/workflow/prepare-upstream-pr.sh
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

## Evidence

- A clean frozen workspace install passes. After refreshing Core's emitted
  declarations, the complete package build passes all ten participating Turbo
  tasks.
- The actual staged pre-commit hook passes lint-staged, build-artifact checks,
  repository-wide source and test typechecks, and the root coverage suite.
  Pipeline's package run passes 82 suites and 563 tests with 99.97% statements,
  99.86% branches, 99.88% functions and 100% lines.
- One local 2.0.0 candidate contains 179 canonical entries and passes the full
  packed Bundler, strict NodeNext, declaration-reachability, negative-contract,
  native runtime and v1 migration qualification. Its identity is SHA-512
  `ef42a2d887fd10738dac33e5b39d466eefefadcad74d64caa45365ea52c511df5e1bf6fc1df2b59bb6509a8705519d08936c015ae1731ba4962623789873d3a7`,
  SRI
  `sha512-70Ki2If9EHONrDPls51Gbu/vrcrXTWTKpFNl6lLFEd9eG/b8HfK1m7ZQmocFUZ0Ik2wBWuFzG6SWJiN4mHPTpw==`
  and shasum `060cee507c1c801464d5abd676648fdc49221721`.
- Runtime-only qualification passes against that exact archive under Node
  20.19.5, 22.20.0 and 24.19.0. The consumer lock records the supplied archive
  integrity rather than a workspace link.
- Forced API generation, its immediate cached rerun and a clean site build
  pass. The authored Pipeline route, generated 2.0.0 root, `maybeAll` and
  `AwaitedTuple` routes exist; stale v1 HTML and private implementation names
  do not.
- Independent reviews are clean for middleware typing, archive hygiene, the
  packed qualifier, TypeDoc projection, public prose, installed Task Graph
  resolution and the trusted release workflow.
- Final upstream-diff review removed the observer dispatcher's hidden mutable
  closure cell. Observer delivery is now represented by explicit process-local
  runtime data and module functions; focused observer, effects, suspension and
  diagnostics suites, the full package suite and packed qualification pass.
- The repository planner uses exact `@geekist/task-graph@0.1.0-beta.4`; its
  installed dependency resolves exact Pipeline 1.4.1 while first-party
  WPKernel packages continue to resolve local v2 source.
- The upstream-rebased documentation projection is deterministic across two
  forced generations, with tree hash
  `8d55be8e3120b485ae12c270beed1459d2aa874c2908776be988bafd964bf2c3`.
  Cached generation, all API routes and the VitePress dead-link build pass.
- TypeDoc still reports five pre-existing CLI and test-utils source-comment
  warnings. Its deterministic generated Markdown also differs from repository
  Prettier output. Both are deferred generator-policy debt: generated API is
  never hand-edited, and neither finding changes the qualified Pipeline surface
  or a published route.
- Upstream PR 399 merged as `a8f46132f37ac0b506aa6c376204701ef01f8098`.
  Main CI run 32560994524 and documentation deployment 32560994532 pass on
  that exact merge commit.
- The first `pipeline-v2.0.0` trusted-publishing run, 32561246943, failed closed
  before packing or publication because its admission shell referenced
  `GITHUB_TOKEN` without mapping `github.token` into the step environment. The
  recovery contribution made that capability explicit. npm was independently
  confirmed to contain no 2.0.0 publication before the failed tag was replaced.
- Recovery PR 400 merged as `b1198b692addc6b3957eeea686105847c486addb`.
  Main CI run 32561750002 and documentation deployment 32561750008 pass on
  that exact merge commit. `pipewrk` then recreated `pipeline-v2.0.0` at that
  commit.
- Trusted-publishing run 32561994256 passes release admission, the single-pack
  build, full packed qualification, runtime qualification under Node 20,
  22.20.0 and 24, OIDC publication and registry verification. The published
  archive contains 179 canonical entries and has SHA-512
  `821b2b5fea1db4b6e5390552faa1c09ed53df3daa635abc0401dc93a965745338a5130920dd0680f58ddd589057d16694f30454eaa6346d892ace36ad48f49df`,
  SRI
  `sha512-ghsrX+odtLblOQVS+qHAntU989qmNavAQB3JOpZXRTOKUTCSDdBoD1jd1YkFfRZpTzBFTqpjRtiSrONq1I9J3w==`
  and shasum `6cef21eb8c48ec796d541f4b6144bc0cf810047c`.
- Independent registry checks return `@wpkernel/pipeline@2.0.0`, bind `latest`
  to 2.0.0 and reproduce the release artifact's SRI and shasum. The authored
  Pipeline page and generated API root both return HTTP 200 from
  `wpkernel.dev`.
