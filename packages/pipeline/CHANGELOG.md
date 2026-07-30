# Changelog

All notable changes to `@wpkernel/pipeline` are recorded here. The package is
versioned and released independently from the WPKernel monorepo.

## 1.2.0 — 2026-07-30

Measured from the published `1.1.0` baseline.

### Added

- A documented, root-exported typed custom-stage API:
  `AgnosticPipelineOptions`, `PipelineStageDependencies`,
  `PipelineStageState`, `PipelineStageResult`, `PipelineStage`,
  `PipelineHelperStageOptions`, `PipelineRegisteredHelper`,
  `PipelineHelperRollback`, `PipelineStageDiagnostics`, and `PipelineHalt`.
- Typed `next(output?)` continuations that return the final downstream output.
- Packed external-consumer qualification covering public-only imports,
  inference, negative type checks, immutable state replacement, and
  synchronous completion.

### Changed

- Helper replacement output is authoritative for later helpers.
- `PipelineStageState` is branded so custom-stage replacements are derived
  from the state supplied by the runner.
- Public `PipelineStep` values now agree with their runtime representation.
- Duplicate dependency edges are harmless.
- Pause snapshots are explicitly documented as process-local suspension
  values, not durable checkpoints.

### Fixed

- Helper rollbacks persist across stages and unwind in reverse visitation
  order for thrown errors, rejected promises, error-bearing halts, result
  failures, commit failures, and resumed failures.
- `throw undefined`, bare `Promise.reject()`, and `halt(undefined)` remain
  failures after rollback.
- Custom-stage state replacement preserves hidden runner bookkeeping,
  including rollback, extension, diagnostic, and ordering state.
- Extension lifecycle states commit exactly once.
- Diagnostics and reporters are invocation-owned, with registration
  diagnostics included in completed and paused results.

### Compatibility

The runtime and all known repository consumers remain compatible. The release
intentionally narrows the formerly erased `createStages` declaration and gives
the previously undocumented root `PipelineStage` export its supported public
meaning. Under a strict policy that treats all TypeScript declaration
tightening as breaking, classify the release as `2.0.0` instead.
