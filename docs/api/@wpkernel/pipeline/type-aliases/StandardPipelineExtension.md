[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / StandardPipelineExtension

# Type Alias: StandardPipelineExtension&lt;TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt;

```ts
type StandardPipelineExtension&lt;TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt; = PipelineExtension&lt;Pipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt;, TContext, TRunOptions, TArtifact&gt;;
```

Extension descriptor specialised to a standard fragment-and-builder
pipeline. Hooks receive the finalised public artifact rather than internal
draft or bookkeeping state.

A hook without explicit lifecycle metadata defaults to `after-fragments`.
Standard pipelines schedule hooks after draft finalisation at
`after-fragments`, `before-builders`, `after-builders`, and `finalize`.
Artifact replacements are adopted before the next hook or phase. Commit and
rollback callbacks retain their registration identity and participate in the
run transaction.

Registration may perform synchronous or asynchronous setup. A run waits for
registration to become quiescent, then captures an immutable registration
snapshot. Extensions added after that boundary participate in later runs.

## Type Parameters

### TRunOptions

`TRunOptions`

### TRunResult

`TRunResult`

### TContext

`TContext` *extends* `object`

### TReporter

`TReporter` *extends* [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TBuildOptions

`TBuildOptions` = `unknown`

### TArtifact

`TArtifact` = `unknown`

### TFragmentInput

`TFragmentInput` = `unknown`

### TFragmentOutput

`TFragmentOutput` = `unknown`

### TBuilderInput

`TBuilderInput` = `unknown`

### TBuilderOutput

`TBuilderOutput` = `unknown`

### TDiagnostic

`TDiagnostic` *extends* [`PipelineDiagnostic`](PipelineDiagnostic.md) = [`PipelineDiagnostic`](PipelineDiagnostic.md)

### TFragmentKind

`TFragmentKind` *extends* [`HelperKind`](HelperKind.md) = `"fragment"`

### TBuilderKind

`TBuilderKind` *extends* [`HelperKind`](HelperKind.md) = `"builder"`

### TFragmentHelper

`TFragmentHelper` *extends* [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt; = [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt;

### TBuilderHelper

`TBuilderHelper` *extends* [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt; = [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt;

## See

[Pipeline.extensions](../interfaces/Pipeline.md#extensions)
