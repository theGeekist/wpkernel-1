[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / makeResumablePipeline

# Function: makeResumablePipeline()

```ts
function makeResumablePipeline<
	TRunOptions,
	TContext,
	TReporter,
	TUserState,
	TDiagnostic,
	TRunResult,
	TKind,
>(
	options
): ResumablePipeline<
	TRunOptions,
	TRunResult,
	TContext,
	TReporter,
	AgnosticState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>
>;
```

## Type Parameters

### TRunOptions

`TRunOptions`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TUserState

`TUserState` = `unknown`

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)<`TUserState`, `TDiagnostic`>

### TKind

`TKind` _extends_ `string` = `string`

## Parameters

### options

[`AgnosticPipelineOptions`](../interfaces/AgnosticPipelineOptions.md)<`TRunOptions`, `TContext`, `TReporter`, `TUserState`, `TDiagnostic`, `TRunResult`, `TKind`>

## Returns

[`ResumablePipeline`](../interfaces/ResumablePipeline.md)<`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `AgnosticState`<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>>
