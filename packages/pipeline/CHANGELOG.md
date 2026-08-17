# Changelog

All notable changes to `@wpkernel/pipeline` are recorded here. The package is
versioned and released independently from the WPKernel monorepo.

## 1.4.1 - 2026-08-18

### Fixed

- Rejected standard-pipeline configurations where fragment and builder helper
  kinds are identical, preventing ambiguous registration and execution.
- Emitted explicit `.js` specifiers for relative ESM declaration imports so
  clean packed consumers typecheck under strict NodeNext resolution, and added
  NodeNext to packed archive qualification.

## 1.4.0 — 2026-08-12

### Changed

- Replaced separate helper and extension rollback stacks with one transaction
  journal. Rollback now follows strict reverse execution chronology across
  helper stages and extension lifecycles, including failures after pause,
  resume, and commit checkpoints. For execution `A → E → B`, rollback is now
  `B → E → A`; previously all helpers unwound before extensions.
- Pause snapshots are now single-use capabilities bound to their creating
  pipeline instance. Their public state is a projection; authoritative runner
  state and transaction records remain private.
- Helper kinds configured at construction now constrain `pipeline.use()` in
  TypeScript. Standard generic registration accepts only fragment and builder
  helpers, and preserves the original helper object and prototype methods.
- Custom run-result types now require an explicit `createRunResult` adapter.
- Public error halts must carry an error and successful halts must carry a
  result; bare halts are no longer a typed success path.

### Fixed

- Captured helper and extension commit/rollback callbacks as immutable
  occurrence records, preventing later consumer mutation from deleting or
  replacing admitted compensation.
- Bound rollback diagnostics to the exact helper occurrence when multiple
  helpers reuse one rollback descriptor.
- Protected the transaction journal with a private symbol so custom stage
  fields named `rollbackJournal` cannot overwrite cleanup state.
- Allowed paused runs to resume independently of registrations started later;
  later failures still invalidate new runs without stranding existing work.
- Rejected foreign, forged, repeated and concurrent snapshot resumes.
- Preserved extension registration order across asynchronous setup and rejected
  duplicate extension keys.
- Routed failures raised while adopting a fulfilled stage result through the
  normal rollback boundary.
- Kept diagnostic and reporter observers from changing pipeline settlement.
- Removed declaration-only `pipeline.providedKeys`, inert helper `optional`
  metadata, the deprecated `hookSequence` rollback alias, the callable-helper
  compatibility branch, and the unused rollback `source` option.
- Exported the `AgnosticPipeline` return type from the package root.
- Expanded TSDoc across every root public declaration and member with lifecycle,
  ownership, failure and synchronous-settlement semantics, examples, and
  cross-links, then regenerated the package API reference from source.

### Breaking

- Agnostic pipelines must provide `createState`; the runtime no longer
  fabricates `{}` as an arbitrary state.
- Removed inert helper `optional` metadata and the declaration-only
  `pipeline.providedKeys` instance property.
- Error halts require an error argument, extension keys must be unique, and
  resumable snapshots are same-instance and single-use.

## 1.3.0 — 2026-08-12

### Changed

- Consolidated normal and resumable pipeline construction behind one internal
  runtime without changing their public factory names.
- Centralised synchronous-or-asynchronous adoption so helpers, stages,
  extensions, commits, and rollbacks share the hardened thenable boundary.
- Simplified runner preparation, settlement, diagnostics, and rollback state
  while preserving synchronous completion, process-local suspension, and
  reverse-order cleanup.
- Captured helper and extension configuration once per run after pending
  extension registrations reach quiescence. Registrations made during an
  active or paused run apply to later runs.
- Modelled helper dependencies with one indexed graph representation while
  preserving priority, override, and dependency ordering.
- Normalised permissive public halt values into explicit internal terminal
  states at the stage boundary.

### Fixed

- Retained failed asynchronous extension registrations until the next run can
  observe the failure.
- Forwarded helper rollback failures through the configured callback.
- Removed standard-pipeline configuration fields that compiled but had no
  runtime effect.
- Kept the first synchronous or asynchronous extension registration failure
  attached to the pipeline so every later run observes the invalid
  configuration.
- Rejected helpers whose kind is not configured for the pipeline instead of
  registering work that can never execute.
- Settled launched downstream helper work before propagating a wrapper failure,
  ensuring downstream cleanup is registered before rollback begins.
- Froze copied helper dependency metadata as part of the immutable helper
  descriptor.

### Breaking

- Removed wildcard `core` and `extensions` subpath exports. The package root is
  the supported public entry point; runner implementation files are private.
- Standard extension hooks now begin after fragment finalisation, so every hook
  receives the declared artifact type. Removed the unsound `prepare` and
  `before-fragments` standard lifecycle stages and the ignored
  `createExtensionHookOptions` option.
- Removed speculative extension blueprints, identity-only error helpers,
  low-level registration/execution exports, the unimplemented `merge` helper
  mode, and other internal types previously exposed through wildcard paths.

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
