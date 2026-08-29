---
id: p2-008
title: Generate and verify the v2 API documentation projection
stage: qualification
status: done
priority: high
evidence_milestone: 'Exact-semantic generated projection, generator-aware cache, truthful v1 cleanup vocabulary, packed boundary and both site routes qualified and independently reviewed clean'
forward_to: []
depends_on:
    - p2-007
decision_dependencies:
    - ADR-001
    - ADR-002
    - ADR-003
conflicts_with:
    - p2-009
write_scope:
    - docs/api/@wpkernel/**
    - docs/internal/pipeline/contracts/v2-public-contract.md
    - docs/internal/pipeline/contracts/v2-vocabulary.md
    - docs/internal/pipeline/decisions/ADR-003-middleware-extensions-effects.md
    - docs/internal/pipeline/tasks/P2-018-public-maybe-promise-composition.md
    - docs/packages/pipeline.md
    - docs/packages/pipeline/execution-and-effects.md
    - packages/cli/src/index.ts
    - packages/php-json-ast/src/programBuilder.ts
    - packages/pipeline/scripts/qualify-packed-api.mjs
    - packages/pipeline/README.md
    - packages/pipeline/src/core/helper.ts
    - packages/pipeline/src/core/rollback.ts
    - packages/pipeline/src/core/types.ts
    - packages/pipeline/src/core/async-utils.ts
    - packages/pipeline/src/standard-pipeline/__tests__/public-entries.test.ts
    - packages/pipeline/src/v2/__tests__/public-surface.test.ts
    - packages/pipeline/src/v2/index.ts
    - packages/pipeline/src/v1.ts
    - packages/pipeline/src/v2/pipeline/runtime.ts
    - packages/pipeline/src/v2/pipeline/types.ts
    - packages/pipeline/src/v2/suspension/types.ts
    - scripts/postprocess-typedoc.mjs
    - scripts/docs/api-cache.cjs
    - scripts/docs/api-cache.d.cts
    - scripts/docs/build-api.ts
    - scripts/docs/typedoc-public-surface.mjs
    - tests/__tests__/scripts/docs-api-cache.test.ts
    - tests/__tests__/scripts/typedoc-public-surface.test.ts
    - typedoc.json
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
    - packages/cli/src/index.ts
    - packages/php-json-ast/src/programBuilder.ts
    - packages/pipeline/scripts/qualify-packed-api.mjs
    - packages/pipeline/src/**
    - packages/pipeline/README.md
    - docs/packages/pipeline/**
    - scripts/docs/**
    - scripts/postprocess-typedoc.mjs
    - tests/__tests__/scripts/**
review_owner: coordinator
updated_at: 2026-08-22
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
- The generator post-processing leaves every generated Markdown file clean
  under `git diff --check` without relying on staged-file mutation.
- Every integrated public v2 symbol appears in the generated Pipeline API.
- Site output contains the authored `/packages/pipeline.html` page and the
  generated `/api/@wpkernel/pipeline/index.html` package landing page.

## Verification

`pnpm docs:api`, clean generated diff inspection, `pnpm docs:site`, route
existence checks and API-surface completeness review.

Suggested execution tier: fast mechanical projection with independent
completeness review.

## Evidence

- Focused cache and TypeDoc projection regressions pass: fourteen tests cover all
  generator and cache implementation inputs, the direct production input
  collector, the complete projection, missing and reordered targets, wrong
  checked-helper generic arguments, and semantic drift in each projected alias
  right-hand side. They also reject drift in both rewritten
  `CreatePipelineOptions` constraints and every projected alias `TExtensions`
  constraint before any mutation occurs.
- Repository-wide `pnpm typecheck:tests` passes all nine participating package
  tasks. The import-safe CJS runtime plus `.d.cts` seam keeps the root cache test
  out of package composite TypeScript file lists while executing the production
  collector and signature implementation directly.
- Pipeline build, source and test typechecks, lint, the 82-suite and 564-test
  package run, and packed Bundler plus NodeNext qualification pass. Packed
  qualification accepts `HelperRollback` as a type while rejecting the
  rollback factory and retained nominal token projections.
- CLI and PHP JSON AST source typechecks and lint pass with the type-only v1
  compatibility re-exports. Generated `HelperRollback.run` now retains the
  explicit `MaybePromise<TResult>` synchronous-or-thenable contract and
  documents read-once adoption.
- `pnpm docs:api --force` regenerates the complete API projection and the next
  `pnpm docs:api` is a cache hit. Generated private-name and malformed-signature
  searches return no matches, and the repaired local compatibility links
  resolve.
- Focused formatting and `git diff --check` pass. The coordinator-owned
  `pnpm docs:site` build passes, including the authored Pipeline page, generated
  Pipeline API landing page, `maybeAll` function page and `AwaitedTuple` type
  page.
- Independent review is clean after verifying that every projected semantic
  tree and rewritten generic constraint is validated before the first TypeDoc
  reflection mutation.
