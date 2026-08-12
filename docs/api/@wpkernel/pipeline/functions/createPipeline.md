[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / createPipeline

# Function: createPipeline()

```ts
function createPipeline<TRunOptions, TBuildOptions, TContext, TReporter, TDraft, TArtifact, TDiagnostic, TRunResult, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper>(options): Pipeline<TRunOptions, TRunResult, TContext, TReporter, TBuildOptions, TArtifact, TFragmentInput, TFragmentOutput, TBuilderInput, TBuilderOutput, TDiagnostic, TFragmentKind, TBuilderKind, TFragmentHelper, TBuilderHelper>;
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

`TContext` *extends* `object`

### TReporter

`TReporter` *extends* [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TDraft

`TDraft` = `unknown`

### TArtifact

`TArtifact` = `unknown`

### TDiagnostic

`TDiagnostic` *extends* [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

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

`TFragmentKind` *extends* `string` = `"fragment"`

### TBuilderKind

`TBuilderKind` *extends* `string` = `"builder"`

### TFragmentHelper

`TFragmentHelper` *extends* [`Helper`](../interfaces/Helper.md)<`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`> = [`Helper`](../interfaces/Helper.md)<`TContext`, `TFragmentInput`, `TFragmentOutput`, `TReporter`, `TFragmentKind`>

### TBuilderHelper

`TBuilderHelper` *extends* [`Helper`](../interfaces/Helper.md)<`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`> = [`Helper`](../interfaces/Helper.md)<`TContext`, `TBuilderInput`, `TBuilderOutput`, `TReporter`, `TBuilderKind`>

## Parameters

### options

[`CreatePipelineOptions`](../type-aliases/CreatePipelineOptions.md)<`TRunOptions`, `TBuildOptions`, `TContext`, `TReporter`, `TDraft`, `TArtifact`, `TDiagnostic`, `TRunResult`, `TFragmentInput`, `TFragmentOutput`, `TBuilderInput`, `TBuilderOutput`, `TFragmentKind`, `TBuilderKind`, `TFragmentHelper`, `TBuilderHelper`>

Standard pipeline factories, adapters and observers.

## Returns

[`Pipeline`](../interfaces/Pipeline.md)<`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TBuildOptions`, `TArtifact`, `TFragmentInput`, `TFragmentOutput`, `TBuilderInput`, `TBuilderOutput`, `TDiagnostic`, `TFragmentKind`, `TBuilderKind`, `TFragmentHelper`, `TBuilderHelper`>

A configured standard pipeline instance.

## Example

```ts
const pipeline = createStandardPipeline({
  createBuildOptions: () => ({}),
  createContext: () => ({ reporter: console }),
  createFragmentState: () => [] as string[],
  createFragmentArgs: ({ context, draft }) => ({
    context,
    input: undefined,
    output: draft,
    reporter: context.reporter,
  }),
  finalizeFragmentState: ({ draft }) => ({ entries: draft }),
  createBuilderArgs: ({ context, artifact }) => ({
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
