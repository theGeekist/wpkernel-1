[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / AgnosticPipelineOptions

# Type Alias: AgnosticPipelineOptions&lt;TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind&gt;

```ts
type AgnosticPipelineOptions&lt;TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind&gt; = AgnosticPipelineBaseOptions&lt;TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind&gt; & RunResultAdapter&lt;PipelineRunState&lt;TUserState, TDiagnostic&gt;, TRunResult, AgnosticRunResultFactory&lt;TRunOptions, TUserState, TContext, TReporter, TDiagnostic, TRunResult&gt;&gt;;
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

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)&lt;`TUserState`, `TDiagnostic`&gt;

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
const options: AgnosticPipelineOptions&lt;
  { source: string },
  { reporter: PipelineReporter },
  PipelineReporter,
  { text: string }
&gt; = {
  helperKinds: ['transform'],
  createContext: () =&gt; ({ reporter: { warn: console.warn } }),
  createState: ({ options }) =&gt; ({ text: options.source })
};
```

## See

[PipelineStageDependencies](../interfaces/PipelineStageDependencies.md)
