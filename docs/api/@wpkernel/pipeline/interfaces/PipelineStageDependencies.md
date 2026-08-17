[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineStageDependencies

# Interface: PipelineStageDependencies&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic, TRunResult, TKind&gt;

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

`TRunResult` = [`PipelineRunState`](PipelineRunState.md)&lt;`TUserState`, `TDiagnostic`&gt;

Terminal result returned by the pipeline.

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Configured helper-kind union.

## Properties

### commitStage

```ts
readonly commitStage: PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
```

Creates an explicit extension-commit boundary.

#### Remarks

Pending commit callbacks run sequentially in their original hook-execution
order. Most compositions can rely on terminal settlement; use this stage
only when a custom composition deliberately needs an earlier commit point.

***

### diagnostics

```ts
readonly diagnostics: PipelineStageDiagnostics&lt;TDiagnostic, TKind&gt;;
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
readonly finalizeResult: PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
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
readonly halt: (error) =&gt; PipelineHalt&lt;TRunResult&gt;;
```

Creates a failure halt. Returning it from a stage stops execution and
initiates reverse-order rollback before the error is rethrown.

#### Parameters

##### error

`unknown`

#### Returns

[`PipelineHalt`](../type-aliases/PipelineHalt.md)&lt;`TRunResult`&gt;

***

### isHalt()

```ts
readonly isHalt: (value) =&gt; value is PipelineHalt&lt;TRunResult&gt;;
```

Runtime type guard for terminal [PipelineHalt](../type-aliases/PipelineHalt.md) values.

#### Parameters

##### value

`unknown`

#### Returns

`value is PipelineHalt&lt;TRunResult&gt;`

***

### makeHelperStage()

```ts
readonly makeHelperStage: &lt;TInput, TOutput, TSelectedKind, THelper&gt;(kind, options?) =&gt; PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
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

`THelper` *extends* [`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`&gt; = [`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`&gt;

#### Parameters

##### kind

`TSelectedKind`

##### options?

[`PipelineHelperStageOptions`](PipelineHelperStageOptions.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TContext`, `TInput`, `TOutput`, `TReporter`, `TSelectedKind`, `THelper`&gt;

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TRunResult`&gt;

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
readonly makeLifecycleStage: (lifecycle) =&gt; PipelineStage&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;, TRunResult&gt;;
```

Creates a stage for one configured extension lifecycle.

#### Parameters

##### lifecycle

`string`

#### Returns

[`PipelineStage`](../type-aliases/PipelineStage.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;, `TRunResult`&gt;

#### Remarks

Hooks registered for the lifecycle run sequentially in registration order
and thread their artifact replacements. Repeating the same lifecycle is a
no-op after its first successful execution. If a hook fails, hooks already
completed in that lifecycle roll back in reverse order before the error is
propagated.

***

### pause()?

```ts
readonly optional pause: (state, options?) =&gt; PipelinePaused&lt;PipelineStageState&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic&gt;&gt;;
```

Suspends a resumable run at the current stage.

#### Parameters

##### state

[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;

##### options?

[`PipelinePauseOptions`](PipelinePauseOptions.md)

#### Returns

[`PipelinePaused`](PipelinePaused.md)&lt;[`PipelineStageState`](PipelineStageState.md)&lt;`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`&gt;&gt;

#### Remarks

Present only for a [ResumablePipeline](ResumablePipeline.md). The returned snapshot is a
single-use capability tied to this pipeline instance and process. Resuming
re-enters the same stage with `resumeInput` on state.
