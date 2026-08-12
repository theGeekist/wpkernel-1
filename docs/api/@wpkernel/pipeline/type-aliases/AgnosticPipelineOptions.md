[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / AgnosticPipelineOptions

# Type Alias: AgnosticPipelineOptions<TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind>

```ts
type AgnosticPipelineOptions<TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind> = AgnosticPipelineBaseOptions<TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind> & RunResultAdapter<PipelineRunState<TUserState, TDiagnostic>, TRunResult, AgnosticRunResultFactory<TRunOptions, TUserState, TContext, TReporter, TDiagnostic, TRunResult>>;
```

Options for creating an agnostic core pipeline.

A custom run result requires an explicit adapter. Omitting the adapter fixes
the result to the standard `{ artifact, diagnostics, steps }` shape.

## Type Parameters

### TRunOptions

`TRunOptions`

Input supplied to the returned pipeline's `run` method.

### TContext

`TContext` *extends* `object`

Per-run context containing the reporter.

### TReporter

`TReporter` *extends* [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

Reporter exposed by the context.

### TUserState

`TUserState` = `unknown`

User-owned artifact threaded through stages.

### TDiagnostic

`TDiagnostic` *extends* [`PipelineDiagnostic`](PipelineDiagnostic.md) = [`PipelineDiagnostic`](PipelineDiagnostic.md)

Diagnostic union recorded by the runner.

### TRunResult

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)<`TUserState`, `TDiagnostic`>

Public successful run result.

### TKind

`TKind` *extends* [`HelperKind`](HelperKind.md) = [`HelperKind`](HelperKind.md)

Helper-kind union accepted by the pipeline.

## Remarks

`createContext` and `createState` define the per-run boundary. By default the
configured helper kinds execute in array order and the result is
[PipelineRunState](../interfaces/PipelineRunState.md). `createStages` replaces that execution composition;
`createRunResult` replaces only the final public projection.

## Example

```ts
const options: AgnosticPipelineOptions<
  { source: string },
  { reporter: PipelineReporter },
  PipelineReporter,
  { text: string }
> = {
  helperKinds: ['transform'],
  createContext: () => ({ reporter: { warn: console.warn } }),
  createState: ({ options }) => ({ text: options.source })
};
```

## See

[PipelineStageDependencies](../interfaces/PipelineStageDependencies.md)
