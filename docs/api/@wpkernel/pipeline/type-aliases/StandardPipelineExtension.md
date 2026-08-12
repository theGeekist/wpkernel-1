[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / StandardPipelineExtension

# Type Alias: StandardPipelineExtension<TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper>

```ts
type StandardPipelineExtension<
	TRunOptions,
	TRunResult,
	TContext,
	TReporter,
	TBuildOptions,
	TArtifact,
	TFragmentInput,
	TFragmentOutput,
	TBuilderInput,
	TBuilderOutput,
	TDiagnostic,
	TFragmentKind,
	TBuilderKind,
	TFragmentHelper,
	TBuilderHelper,
> = PipelineExtension<
	Pipeline<
		TRunOptions,
		TRunResult,
		TContext,
		TReporter,
		TBuildOptions,
		TArtifact,
		TFragmentInput,
		TFragmentOutput,
		TBuilderInput,
		TBuilderOutput,
		TDiagnostic,
		TFragmentKind,
		TBuilderKind,
		TFragmentHelper,
		TBuilderHelper
	>,
	TContext,
	TRunOptions,
	TArtifact
>;
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

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

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

`TDiagnostic` _extends_ [`PipelineDiagnostic`](PipelineDiagnostic.md) = [`PipelineDiagnostic`](PipelineDiagnostic.md)

### TFragmentKind

`TFragmentKind` _extends_ [`HelperKind`](HelperKind.md) = `"fragment"`

### TBuilderKind

`TBuilderKind` _extends_ [`HelperKind`](HelperKind.md) = `"builder"`

### TFragmentHelper

`TFragmentHelper` _extends_ [`Helper`](../interfaces/Helper.md)<`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`> = [`Helper`](../interfaces/Helper.md)<`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`>

### TBuilderHelper

`TBuilderHelper` _extends_ [`Helper`](../interfaces/Helper.md)<`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`> = [`Helper`](../interfaces/Helper.md)<`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`>

## See

[Pipeline.extensions](../interfaces/Pipeline.md#extensions)
