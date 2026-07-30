[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / makePipeline

# Function: makePipeline()

```ts
function makePipeline&lt;TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind&gt;(options): AgnosticPipeline&lt;TRunOptions, TRunResult, TContext, TReporter&gt;;
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

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)&lt;`TUserState`, `TDiagnostic`&gt;

### TKind

`TKind` _extends_ `string` = `string`

## Parameters

### options

[`AgnosticPipelineOptions`](../interfaces/AgnosticPipelineOptions.md)&lt;`TRunOptions`, `TContext`, `TReporter`, `TUserState`, `TDiagnostic`, `TRunResult`, `TKind`&gt;

## Returns

`AgnosticPipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`&gt;
