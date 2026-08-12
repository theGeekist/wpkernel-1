[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineHelperStageOptions

# Interface: PipelineHelperStageOptions&lt;TState, TContext, TInput, TOutput, TReporter, TKind, THelper&gt;

Adapters for constructing a typed helper-execution stage.

## Remarks

`makeArgs` selects phase-specific input and output. `writeOutput` adopts the
final helper-chain output into stage state. `onVisited` runs after the chain
and may attach execution metadata or report unused registrations. Omitting
adapters uses the agnostic defaults based on run options and user state.

## Type Parameters

### TState

`TState`

Complete stage-state type.

### TContext

`TContext`

Per-run context type.

### TInput

`TInput`

Input presented to this helper phase.

### TOutput

`TOutput`

Value transformed by the helper chain.

### TReporter

`TReporter` *extends* [`PipelineReporter`](PipelineReporter.md)

Reporter available to helpers.

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md)

Selected helper kind.

### THelper

`THelper` *extends* [`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`&gt;

Concrete helper type stored in the registry.

## Properties

### makeArgs()?

```ts
readonly optional makeArgs: (state) =&gt; (entry) =&gt; HelperApplyOptions&lt;TContext, TInput, TOutput, TReporter&gt;;
```

Builds invocation arguments for each registered helper.

#### Parameters

##### state

`TState`

#### Returns

```ts
(entry): HelperApplyOptions&lt;TContext, TInput, TOutput, TReporter&gt;;
```

##### Parameters

###### entry

[`PipelineRegisteredHelper`](PipelineRegisteredHelper.md)&lt;`THelper`&gt;

##### Returns

[`HelperApplyOptions`](HelperApplyOptions.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`&gt;

***

### onVisited()?

```ts
readonly optional onVisited: (state, visited, registered, rollbacks, output) =&gt; TState;
```

Observes execution and returns the state passed to the next stage.

#### Parameters

##### state

`TState`

##### visited

`ReadonlySet`&lt;`string`&gt;

##### registered

readonly [`PipelineRegisteredHelper`](PipelineRegisteredHelper.md)&lt;`THelper`&gt;[]

##### rollbacks

readonly [`PipelineHelperRollback`](PipelineHelperRollback.md)&lt;`THelper`&gt;[]

##### output

`TOutput`

#### Returns

`TState`

***

### writeOutput()?

```ts
readonly optional writeOutput: (state, output) =&gt; TState;
```

Adopts the chain's final output into stage state.

#### Parameters

##### state

`TState`

##### output

`TOutput`

#### Returns

`TState`
