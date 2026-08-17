[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / createPipeline

# Function: createPipeline()

```ts
function createPipeline&lt;TRunOptions, TBuildOptions, TContext, TReporter, TDraft, TArtifact, TDiagnostic, TRunResult, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt;(options): Pipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper&gt;;
```

Creates an opinionated [Pipeline](../interfaces/Pipeline.md) with fragment and builder helper
phases around a finalised public artifact.

The complete phase sequence is:

1. Ordered fragment helpers
2. Fragment finalisation
3. `after-fragments` extension hooks
4. `before-builders` extension hooks
5. Ordered builder helpers
6. `after-builders` extension hooks
7. `finalize` extension hooks
8. Extension commit and result materialisation

Fragment helpers receive a draft-facing output prepared by
`createFragmentArgs`. Builder helpers receive the finalised artifact prepared
by `createBuilderArgs`. Mutable outputs need no adapter. Immutable replacement
outputs become phase state only through `adoptFragmentOutput` or
`adoptBuilderOutput` in [CreatePipelineOptions](../type-aliases/CreatePipelineOptions.md).

Extension hooks always receive the finalised artifact, never the draft or
internal bookkeeping state. Artifact replacements flow into later hooks and
builders. Registration may be synchronous or asynchronous. Each run waits
for registration quiescence and then captures immutable helper and extension
orders, so later registration affects later runs only.

Diagnostics are invocation-owned. `onDiagnostic` streams them without giving
observer failures control over settlement. Rollback observer failures are
likewise contained while remaining cleanup continues. A custom result type
requires `createRunResult`; otherwise the result is [PipelineRunState](../interfaces/PipelineRunState.md).
The factory preserves synchronous settlement until participating work becomes
asynchronous.

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

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

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

`TFragmentKind` _extends_ `string` = `"fragment"`

### TBuilderKind

`TBuilderKind` _extends_ `string` = `"builder"`

### TFragmentHelper

`TFragmentHelper` _extends_ [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt; = [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`&gt;

### TBuilderHelper

`TBuilderHelper` _extends_ [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt; = [`Helper`](../interfaces/Helper.md)&lt;`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`&gt;

## Parameters

### options

[`CreatePipelineOptions`](../type-aliases/CreatePipelineOptions.md)&lt;`TRunOptions`, `TBuildOptions`, `TContext`, `TReporter`, `TDraft`, `TArtifact`, `TDiagnostic`, `TRunResult`, `TFragmentInput`, `TFragmentOutput`, `TBuilderInput`, `TBuilderOutput`, `TFragmentKind`, `TBuilderKind`, `TFragmentHelper`, `TBuilderHelper`&gt;

Standard pipeline factories, adapters and observers.

## Returns

[`Pipeline`](../interfaces/Pipeline.md)&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TBuildOptions`, `TArtifact`, `TFragmentInput`, `TFragmentOutput`, `TBuilderInput`, `TBuilderOutput`, `TDiagnostic`, `TFragmentKind`, `TBuilderKind`, `TFragmentHelper`, `TBuilderHelper`&gt;

A configured standard pipeline instance.

## Example

```ts
const pipeline = createStandardPipeline({
  createBuildOptions: () =&gt; ({}),
  createContext: () =&gt; ({ reporter: console }),
  createFragmentState: () =&gt; [] as string[],
  createFragmentArgs: ({ context, draft }) =&gt; ({
    context,
    input: undefined,
    output: draft,
    reporter: context.reporter,
  }),
  finalizeFragmentState: ({ draft }) =&gt; ({ entries: draft }),
  createBuilderArgs: ({ context, artifact }) =&gt; ({
    context,
    input: undefined,
    output: artifact,
    reporter: context.reporter,
  }),
});

pipeline.ir.use(fragmentHelper);
pipeline.builders.use(builderHelper);
const result = await pipeline.run({});
```

## See

[Pipeline.extensions](../interfaces/Pipeline.md#extensions)
