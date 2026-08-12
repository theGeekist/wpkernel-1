[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineStageDependencies

# Interface: PipelineStageDependencies<TRunOptions, TUserState, TContext, TReporter, TDiagnostic, TRunResult, TKind>

Stable, domain-neutral dependencies supplied to `createStages`.

## Remarks

These factories preserve runner bookkeeping that a hand-written stage cannot
reproduce safely. The default composition creates one helper stage for each
configured helper kind, in configured-kind order, followed by
[PipelineStageDependencies.finalizeResult](#finalizeresult). A custom composition owns
stage ordering and must include every helper and extension lifecycle it wants
to execute.

Lifecycle hooks execute sequentially in extension-registration order. Helper
stages resolve dependencies before execution. Commit callbacks execute in
forward execution order; rollback callbacks execute in reverse execution
order, and one rollback failure does not prevent later cleanup.

## See

 - [PipelineStage](../type-aliases/PipelineStage.md)
 - [AgnosticPipelineOptions](../type-aliases/AgnosticPipelineOptions.md)

## Type Parameters

### TRunOptions

`TRunOptions`

Input supplied to a new run.

### TUserState

`TUserState`

User-owned artifact threaded through stages.

### TContext

`TContext` *extends* `object`

Per-run context containing the reporter.

### TReporter

`TReporter` *extends* [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

Reporter available to helpers and diagnostics.

### TDiagnostic

`TDiagnostic` *extends* [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

Diagnostic union recorded by the runner.

### TRunResult

`TRunResult` = [`PipelineRunState`](PipelineRunState.md)<`TUserState`, `TDiagnostic`>

Terminal result returned by the pipeline.

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Configured helper-kind union.

## Properties

### commitStage

```ts
readonly commitStage: PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

Creates an explicit extension-commit boundary.

#### Remarks

Pending commit callbacks run sequentially in their original hook-execution
order. Most compositions can rely on terminal settlement; use this stage
only when a custom composition deliberately needs an earlier commit point.

***

### diagnostics

```ts
readonly diagnostics: PipelineStageDiagnostics<TDiagnostic, TKind>;
```

Diagnostic recording helpers bound to the current run.

***

### extensions

```ts
readonly extensions: object;
```

Read-only extension configuration available to stage composers.

#### lifecycles?

```ts
readonly optional lifecycles: readonly string[];
```

Lifecycle names recognised by this pipeline, in configured order.

***

### finalizeResult

```ts
readonly finalizeResult: PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

Terminal stage that refreshes end-of-run diagnostics and creates the
configured run result.

#### Remarks

Place this after stages that contribute helpers, diagnostics or artifact
state. Lifecycle names configured but never executed are reported through
the pipeline reporter when this stage settles the run.

***

### halt()

```ts
readonly halt: (error) => PipelineHalt<TRunResult>;
```

Creates a failure halt. Returning it from a stage stops execution and
initiates reverse-order rollback before the error is rethrown.

#### Parameters

##### error

`unknown`

#### Returns

[`PipelineHalt`](../type-aliases/PipelineHalt.md)<`TRunResult`>

***

### isHalt()

```ts
readonly isHalt: (value) => value is PipelineHalt<TRunResult>;
```

Runtime type guard for terminal [PipelineHalt](../type-aliases/PipelineHalt.md) values.

#### Parameters

##### value

`unknown`

#### Returns

`value is PipelineHalt<TRunResult>`

***

### makeHelperStage()

```ts
readonly makeHelperStage: <TInput, TOutput, TSelectedKind, THelper>(kind, options?) => PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

Creates a dependency-ordered stage for one configured helper kind.

#### Type Parameters

##### TInput

`TInput` = `TRunOptions`

##### TOutput

`TOutput` = `TUserState`

##### TSelectedKind

`TSelectedKind` *extends* `string` = `TKind`

##### THelper

`THelper` *extends* [`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`> = [`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`>

#### Parameters

##### kind

`TSelectedKind`

##### options?

[`PipelineHelperStageOptions`](PipelineHelperStageOptions.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`, `THelper`>

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TRunResult`>

#### Remarks

Higher priorities execute first, then keys sort alphabetically, then
registration order breaks remaining ties. Dependencies constrain that
order. Keys listed in `providedKeys` satisfy dependencies without adding an
executable helper. Missing dependencies and conflicts become diagnostics;
unusable helpers are not executed.

The optional adapters support phase-specific inputs and state projections
while retaining runner-managed rollback and execution metadata.

***

### makeLifecycleStage()

```ts
readonly makeLifecycleStage: (lifecycle) => PipelineStage<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>, TRunResult>;
```

Creates a stage for one configured extension lifecycle.

#### Parameters

##### lifecycle

`string`

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TRunResult`>

#### Remarks

Hooks registered for the lifecycle run sequentially in registration order
and thread their artifact replacements. Repeating the same lifecycle is a
no-op after its first successful execution. If a hook fails, hooks already
completed in that lifecycle roll back in reverse order before the error is
propagated.

***

### pause()?

```ts
readonly optional pause: (state, options?) => PipelinePaused<PipelineStageState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>>;
```

Suspends a resumable run at the current stage.

#### Parameters

##### state

[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>

##### options?

[`PipelinePauseOptions`](PipelinePauseOptions.md)

#### Returns

[`PipelinePaused`](PipelinePaused.md)<[`PipelineStageState`](PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>>

#### Remarks

Present only for a [ResumablePipeline](ResumablePipeline.md). The returned snapshot is a
single-use capability tied to this pipeline instance and process. Resuming
re-enters the same stage with `resumeInput` on state.
