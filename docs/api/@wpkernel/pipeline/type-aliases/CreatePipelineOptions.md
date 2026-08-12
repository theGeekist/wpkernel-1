[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / CreatePipelineOptions

# Type Alias: CreatePipelineOptions<TRunOptions, TBuildOptions, TContext, TReporter, TDraft, TArtifact, TDiagnostic, TRunResult, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper>

```ts
type CreatePipelineOptions<
	TRunOptions,
	TBuildOptions,
	TContext,
	TReporter,
	TDraft,
	TArtifact,
	TDiagnostic,
	TRunResult,
	TFragmentInput,
	TFragmentOutput,
	TBuilderInput,
	TBuilderOutput,
	TFragmentKind,
	TBuilderKind,
	TFragmentHelper,
	TBuilderHelper,
> = CreatePipelineBaseOptions<
	TRunOptions,
	TBuildOptions,
	TContext,
	TReporter,
	TDraft,
	TArtifact,
	TDiagnostic,
	TFragmentInput,
	TFragmentOutput,
	TBuilderInput,
	TBuilderOutput,
	TFragmentKind,
	TBuilderKind,
	TFragmentHelper,
	TBuilderHelper
> &
	RunResultAdapter<
		PipelineRunState<TArtifact, TDiagnostic>,
		TRunResult,
		StandardRunResultFactory<
			TRunOptions,
			TBuildOptions,
			TContext,
			TArtifact,
			TDiagnostic,
			TRunResult,
			TFragmentKind,
			TBuilderKind
		>
	>;
```

Options for creating a standard pipeline.

A run creates build options, context and draft, executes fragment helpers,
finalises the draft, runs `after-fragments` and `before-builders` extension
hooks, executes builder helpers, then runs `after-builders` and `finalize`
hooks before materialising the result.

Fragment and builder helpers may mutate shared output objects. When helpers
instead return immutable replacement values, provide `adoptFragmentOutput`
or `adoptBuilderOutput` to make those replacements the input to the next
phase. A custom `TRunResult` requires `createRunResult`; omitting the adapter
fixes the result to [PipelineRunState](../interfaces/PipelineRunState.md).

## Type Parameters

### TRunOptions

`TRunOptions`

### TBuildOptions

`TBuildOptions`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TDraft

`TDraft` = `unknown`

### TArtifact

`TArtifact` = `unknown`

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](PipelineDiagnostic.md) = [`PipelineDiagnostic`](PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)<`TArtifact`, `TDiagnostic`>

### TFragmentInput

`TFragmentInput` = `unknown`

### TFragmentOutput

`TFragmentOutput` = `unknown`

### TBuilderInput

`TBuilderInput` = `unknown`

### TBuilderOutput

`TBuilderOutput` = `unknown`

### TFragmentKind

`TFragmentKind` _extends_ [`HelperKind`](HelperKind.md) = `"fragment"`

### TBuilderKind

`TBuilderKind` _extends_ [`HelperKind`](HelperKind.md) = `"builder"`

### TFragmentHelper

`TFragmentHelper` _extends_ [`Helper`](../interfaces/Helper.md)<`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`> = [`Helper`](../interfaces/Helper.md)<`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`>

### TBuilderHelper

`TBuilderHelper` _extends_ [`Helper`](../interfaces/Helper.md)<`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`> = [`Helper`](../interfaces/Helper.md)<`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`>

## Example

```ts
const pipeline = createPipeline({
	createBuildOptions: () => ({}),
	createContext: () => ({ reporter: console }),
	createFragmentState: () => [] as string[],
	createFragmentArgs: ({ context, draft }) => ({
		context,
		input: undefined,
		output: draft,
		reporter: context.reporter,
	}),
	adoptFragmentOutput: ({ output }) => output,
	finalizeFragmentState: ({ draft }) => ({ entries: draft }),
	createBuilderArgs: ({ context, artifact }) => ({
		context,
		input: undefined,
		output: artifact,
		reporter: context.reporter,
	}),
});
```

## See

- [Pipeline](../interfaces/Pipeline.md)
- [StandardPipelineExtension](StandardPipelineExtension.md)
