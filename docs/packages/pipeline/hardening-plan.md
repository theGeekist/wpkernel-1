# Historical `@wpkernel/pipeline` hardening record
> This page preserves the 1.2-era plan and its evidence as release history.
> Version numbers, consumer pins, phase status and release gaps below describe
> that work at the time. They are not current release guidance or a public v2
> roadmap.

## Purpose

This plan tracked the generic pipeline work required before `llm-core` treated
`@wpkernel/pipeline` as the stable execution substrate for specification
compilation and runtime orchestration.

The architectural boundary remains:

- `@wpkernel/pipeline` owns generic ordering, composition, rollback,
  diagnostics, suspension, and execution mechanics.
- `llm-core` owns specification semantics, LLM-specific state, portable
  checkpoints, plan identity, approvals, and durable runtime envelopes.

## Recorded baseline

### Verification

- Pipeline source typecheck: passed.
- Pipeline test typecheck: passed.
- Pipeline build: passed.
- Pipeline lint: passed with zero errors and warnings.
- Pipeline tests: 37 suites and 156 tests passed.
- Pipeline coverage: 94.80% statements, 85.36% branches, 94.72%
  functions, and 94.64% lines.
- Packed external-consumer API qualification: passed against the locally
  packed manifest version, including root-only imports, positive and negative
  type checks, immutable output propagation, `next(output?)`, and synchronous
  completion.
- Every changed source file in dependent WPKernel packages passes ESLint.
- Affected `@wpkernel/core` pipeline tests: 2 suites and 5 tests passed.
- The unavailable `eslint-plugin-early-return@0.0.6` development dependency
  was upgraded to published `0.1.0`; the root manifest and lockfile agree.
- A workspace-wide `pnpm install --frozen-lockfile` completed successfully
  against the updated lockfile, resolving the previous clean-install blocker.
- Direct dependent packages `core`, `php-json-ast`, `test-utils`, and `cli`
  pass their builds, source and test typechecks, lint, and complete test suites.
- Touched transitive package `wp-json-ast` passes build, source and test
  typechecks, lint, and 49 suites / 176 tests; `e2e-utils` also builds.
- Dependent test totals include `core` at 74 suites / 909 tests,
  `php-json-ast` at 23 suites / 94 tests, `test-utils` at 4 suites / 11 tests,
  and `cli` at 165 suites / 857 tests.
- The monorepo build, lint wrapper, source typecheck, formatting check, and
  declaration-import validation pass against freshly generated build outputs.

### Recorded versioning and release status

`@wpkernel/pipeline` is independently versioned:

- Its package manifest now declares the forward release candidate `1.2.0`.
- `llm-core` currently pins the published package at `1.1.0`.
- Its publish configuration uses the npm `beta` tag.
- The monorepo version bump script explicitly skips it.
- `scripts/release/release-pipeline.ts` owns its version bump, build, commit,
  `pipeline-v<version>` tag, and publish hand-off.

Release gaps to resolve:

- Pipeline is not registered in `release-please-config.json` or the Release
  Please manifest.
- Generated pipeline API documentation now reports `1.2.0` and agrees with the
  package manifest.
- Pipeline release and migration notes are maintained in
  `packages/pipeline/CHANGELOG.md`.

The selected release version is `1.2.0`, measured from the published `1.1.0`
consumer baseline. The release adds the first documented, usable custom-stage
type contract and keeps the runtime and all known consumers compatible. The
release notes record the strict type-level semver caveat: `createStages` is
intentionally narrowed from `unknown[]` to valid stages, and the previously
undocumented root `PipelineStage` export now represents the supported public
stage function. Repository and `llm-core` searches found no external source
consumer of that old erased stage surface.

## Phases

| Phase | Scope                                                                                                                                | Status                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1     | Authoritative helper output composition and typed `next(output?)` around-chain semantics                                             | **Implementation complete; package gates pass; release qualification pending**   |
| 2     | Persist helper rollbacks across stages and guarantee pipeline-wide reverse-order unwind                                              | **Implementation complete; package gates pass; release qualification pending**   |
| 3     | Make extension commit exactly-once and resolve the public `commitStage` contract                                                     | **Implementation complete; verified; not released**                              |
| 4     | Align generic step results with `PipelineStep` and deduplicate dependency edges                                                      | **Implementation complete; verified; not released**                              |
| 5     | Make diagnostics and run bookkeeping local to each invocation for safe concurrent reuse                                              | **Implementation complete; verified; not released**                              |
| 6     | Export a stable, generic custom-stage dependency API and remove consumer casts                                                       | **Implementation complete; package and packed API gates pass**                   |
| 7     | Explicitly define the pause mechanism as process-local suspension; document or rename it without promising durable checkpoints       | **Implementation complete; verified; not released**                              |
| 8     | Rewrite pipeline documentation and align pipeline version references across the monorepo                                             | **Complete; generated API and release metadata aligned to `1.2.0`**              |
| 9     | Run release qualification, publish the independently versioned pipeline package, and validate `llm-core` against the packed artifact | **Qualification in progress; final tarball, `llm-core`, CI, and publish remain** |

## Phase 1 — Helper output composition

### Outcome

Helpers now support immutable and mutable composition:

```ts
return { output: transformedOutput };
```

For advanced around-chain behavior:

```ts
const downstreamOutput = await next(transformedOutput);
return { output: postProcess(downstreamOutput) };
```

### Completed

- Exported `HelperNext<TOutput>`.
- Changed `next()` to return the final downstream output.
- Allowed `next(output)` to replace the value passed downstream.
- Made returned `{ output }` authoritative for subsequent helpers.
- Preserved synchronous execution when all work is synchronous.
- Defined repeated `next()` calls as a single memoized continuation.
- Supported explicit recovery after a downstream failure.
- Preserved explicit `undefined` as an intentional returned output.
- Ordered rollback registration by helper visitation under nested
  continuations.
- Added explicit stage output adoption through `writeOutput`.
- Added standard-pipeline draft and artifact adoption hooks for cases where
  helper output and stored state are different generic types.
- Migrated genuine around-chain consumers and removed redundant tail-only
  `next()` calls.
- Updated pipeline documentation and focused tests.

### Remaining before release

- Compile and test `llm-core` against a packed pipeline tarball.

## Phase 2 — Pipeline-wide helper rollback

Make the documented rollback guarantee true across stage boundaries:

### Completed

- Added one run-owned rollback stack ordered by helper visitation across all
  helper kinds and stages.
- Persisted successful helper rollback descriptors into runner state.
- Preserved per-stage rollback data supplied to custom `onVisited` handlers.
- Unwound all completed helpers when a later helper stage fails.
- Added a runner-level boundary for synchronous and asynchronous non-helper
  stage failures.
- Unwound helpers when result materialization or an explicit extension commit
  stage fails.
- Preserved the rollback stack without executing it during process-local
  suspension.
- Preserved the stack in pause snapshots and unwound it if a resumed run later
  fails.
- Treated an unsupported pause in a non-resumable pipeline as failure and
  unwound completed helpers.
- Intercepted error-bearing custom `Halt` results at the stage boundary so
  normal, resumable, and resumed runs unwind before propagating the error.
- Marked internally rolled-back halts to guarantee the same terminal failure
  cannot unwind a rollback stack twice.
- Tracked error presence independently from error value so `throw undefined`,
  bare `Promise.reject()`, and `halt(undefined)` still reject after rollback.
- Preserved helper-before-extension rollback ordering.
- Added cross-stage, async-stage, result, commit, pause, resume, and explicit
  error-halt regression tests.

### Remaining before release

- Validate the rollback contract against `llm-core` custom stage sequences.

## Phase 3 — Exactly-once extension commit

### Completed

- Added one run-owned set of committed extension lifecycle states.
- Made explicit commit stages commit every currently pending lifecycle state.
- Retained implicit final commit for pipelines without an explicit checkpoint.
- Made repeated explicit commit stages idempotent.
- Allowed new lifecycle states created after a checkpoint to be committed by a
  later checkpoint or finalization.
- Preserved rollback on commit failure, with helper rollback preceding
  extension rollback.
- Added repeated-checkpoint, multi-lifecycle, implicit-commit, and
  commit-failure coverage.

### Remaining before release

- Validate custom `llm-core` stage sequences against the packed artifact.

## Phase 4 — Result and dependency-graph contracts

### Completed

- Generic and standard pipelines now return the documented flattened
  `PipelineStep` shape.
- Step traces include descriptor fields plus stable registration `id` and
  `index`.
- Runtime step traces no longer leak helper functions or the internal
  `RegisteredHelper` wrapper.
- Resume appends the same public step shape as an initial run.
- Repeated dependency keys are deduplicated before graph linking.
- Indegree changes only when a new graph edge is actually inserted.
- Added public step-shape and duplicate-dependency regression tests.

### Remaining before release

- Validate packed-artifact step traces in WPKernel and `llm-core` consumers.

## Phase 5 — Run-local diagnostics

### Completed

- Moved mutable run diagnostics into an invocation-owned diagnostic manager.
- Kept registration diagnostics on the pipeline instance and copied them into
  each run without sharing mutable run state.
- Seeded the invocation-owned collection with those copied registration
  diagnostics so process-local pause snapshots expose the same diagnostic
  baseline as completed runs.
- Bound reporter and diagnostic accumulation to each invocation.
- Preserved compatibility with internal diagnostic-manager adapters that do
  not yet implement run-manager creation.
- Reused the invocation-owned manager through process-local pause and resume.
- Added overlapping success/failure, independent pause-snapshot, and
  registration-diagnostic pause regression tests proving diagnostics and
  reporters do not leak between runs or disappear during suspension.

### Remaining before release

- Validate diagnostics against the final `llm-core` packed-artifact consumer.

## Phase 6 — Typed custom-stage API

### Implemented in the working tree

- Added a narrow public `PipelineStageDependencies` facade instead of exporting
  `AgnosticStageDeps` unchanged; the latter exposes mutable runner internals
  and still erases helper inputs and outputs.
- Exported `AgnosticPipelineOptions`, `PipelineStageState`,
  `PipelineStageResult`, `PipelineStage`, `PipelineHelperStageOptions`,
  `PipelineRegisteredHelper`, `PipelineHelperRollback`,
  `PipelineStageDiagnostics`, and `PipelineHalt` from the package root.
- Typed `createState`, `createStages`, and `createRunResult.state` against those
  public generics.
- Preserved inference for helper kind, context, reporter, state, diagnostic,
  helper input/output, registration, rollback, and result.
- Replaced the standard pipeline's internal dependency cast with the public
  facade.
- Branded `PipelineStageState` so consumer-authored state replacements must be
  derived from the supplied state instead of reconstructed from scratch.
- Merged synchronous and asynchronous public-stage replacements onto the
  preceding closed-world runner state, including paused snapshot state, so
  omitted rollback, extension, diagnostic, and ordering fields survive.
- Added runtime regressions proving helper rollbacks survive fresh public-state
  replacements, plus a negative type assertion for fresh state construction.
- Added a root-import-only consumer-style type test with negative assertions
  for invalid helper kinds and invalid stage results.

### Packed qualification

The reusable `qualify:packed` gate now:

- Packs the built package and installs only that tarball into an isolated
  external fixture.
- Compiles root-only public imports with inline `createStages` inference.
- Rejects invalid helper kinds, stage results, and replacement state at
  typecheck time.
- Verifies emitted consumer declarations do not reference `core/runner` or
  `AgnosticStageDeps`.
- Executes immutable helper replacement, typed `next(output?)`, a custom state
  replacement stage, and final result extraction.
- Asserts a fully synchronous pipeline remains synchronous.

The packed qualification now identifies the artifact as `1.2.0`. `llm-core`
still pins the published `1.1.0`; Phase 9 must validate and then bind P2-310 to
the packed and published `1.2.0` contract.

### Consumer finding

Current `llm-core` no longer has a live `createStages` consumer: its legacy
workflow and interaction lanes, including their recreated dependency
interfaces and casts, were removed. They must not be restored merely to prove
this API.

The next intended consumer is the planned specification compiler. The packed
qualification fixture now proves its required generic contract without
restoring deleted legacy lanes. P2-310 remains blocked only on a forward,
published exact version and its corresponding lockfile update.

## Phase 7 — Process-local suspension boundary

### Completed

- Retained `pause`/`resume` terminology for compatibility.
- Documented `PipelinePauseSnapshot` as an in-memory suspension value that can
  contain live maps, sets, callbacks, coordinators, and diagnostic managers.
- Explicitly excluded serialization, storage, transport, version binding, plan
  identity, approval state, and migration from the pipeline contract.
- Assigned durable checkpoint ownership to consumers such as `llm-core`.
- Added a same-process pause/resume regression proving live object identity is
  retained rather than serialized.

### Remaining before release

- None. The process-local boundary is recorded in the package README,
  architecture guide, framework-contributor guide, and `1.2.0` changelog.

## Phase 8 — Documentation and version alignment

### Completed

- Rewrote `packages/pipeline/README.md` around the package's standard and
  agnostic models, helper ordering, mutable and immutable composition,
  `next(output?)`, rollback, extension lifecycle, diagnostics, traces,
  synchronous completion, and process-local suspension contract.
- Added standard-pipeline and public custom-stage examples.
- Updated the architecture, package overview, and framework-contributor guides
  to the final Phase 1–7 contracts.
- Added package-local `1.2.0` release and migration notes in
  `packages/pipeline/CHANGELOG.md`.
- Regenerated the pipeline API reference from the final root export surface,
  including the typed custom-stage and resumable-pipeline contracts.
- Aligned the package manifest, generated API reference, package overview,
  hardening plan, and packed qualification at `1.2.0`.
- Added packed-artifact assertions that the installed package name and version
  are exactly `@wpkernel/pipeline@1.2.0`.

### Remaining before release

- Repeat the documentation/version consistency check against the final packed
  artifact used for release.

## Phase 9 — Release and `llm-core` adoption

Release only after all preceding phases selected for the release train are
complete:

1. Repeat the verified frozen-lockfile installation in the release
   environment.
2. Run official pipeline build, lint, unit, coverage, and typecheck commands.
3. Build and test all WPKernel dependants.
4. Pack `@wpkernel/pipeline` and test its public exports from a clean fixture.
5. Compile and test `llm-core` against that tarball.
6. Confirm the manifest, packed artifact, generated API docs, and release
   notes all identify `1.2.0`.
7. Record migration notes and classify the semver impact.
8. Use the independent pipeline release script, verify the generated tag, and
   publish under the intended npm dist-tag.
