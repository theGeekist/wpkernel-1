[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / CreatePipelineOptions

# Type Alias: CreatePipelineOptions&lt;TRunOptions, TBuildOptions, TContext, TReporter, TDraft, TArtifact, TDiagnostic, TRunResult, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt;

```ts
type CreatePipelineOptions&lt;TRunOptions, TBuildOptions, TContext, TReporter, TDraft, TArtifact, TDiagnostic, TRunResult, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt; = CreatePipelineBaseOptions&lt;TRunOptions, TBuildOptions, TContext, TReporter, TDraft, TArtifact, TDiagnostic, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt; & RunResultAdapter&lt;PipelineRunState&lt;TArtifact, TDiagnostic&gt;, TRunResult, StandardRunResultFactory&lt;TRunOptions, TBuildOptions, TContext, TArtifact, TDiagnostic, TRunResult, TFragmentKind, TBuilderKind&gt;&gt;;
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

`TContext` *extends* `object`

### TReporter

`TReporter` *extends* [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TDraft

`TDraft` = `unknown`

### TArtifact

`TArtifact` = `unknown`

### TDiagnostic

`TDiagnostic` *extends* [`PipelineDiagnostic`](PipelineDiagnostic.md) = [`PipelineDiagnostic`](PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)&lt;`TArtifact`, `TDiagnostic`&gt;

### TFragmentInput

`TFragmentInput` = `unknown`

### TFragmentOutput

`TFragmentOutput` = `unknown`

### TBuilderInput

`TBuilderInput` = `unknown`

### TBuilderOutput

`TBuilderOutput` = `unknown`

### TFragmentKind

`TFragmentKind` *extends* [`HelperKind`](HelperKind.md) = `"fragment"`

### TBuilderKind

`TBuilderKind` *extends* [`HelperKind`](HelperKind.md) = `"builder"`

### TFragmentHelper

`TFragmentHelper` *extends* [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt; = [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt;

### TBuilderHelper

`TBuilderHelper` *extends* [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt; = [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt;

## Example

```ts
const pipeline = createPipeline({
  createBuildOptions: () =&gt; ({}),
  createContext: () =&gt; ({ reporter: console }),
  createFragmentState: () =&gt; [] as string[],
  createFragmentArgs: ({ context, draft }) =&gt; ({
    context,
    input: undefined,
    output: draft,
    reporter: context.reporter,
  }),
  adoptFragmentOutput: ({ output }) =&gt; output,
  finalizeFragmentState: ({ draft }) =&gt; ({ entries: draft }),
  createBuilderArgs: ({ context, artifact }) =&gt; ({
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
