[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineHelperStageOptions

# Interface: PipelineHelperStageOptions<TState, TContext, TInput, TOutput, TReporter, TKind, THelper>

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

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md)

Reporter available to helpers.

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md)

Selected helper kind.

### THelper

`THelper` _extends_ [`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`>

Concrete helper type stored in the registry.

## Properties

### makeArgs()?

```ts
readonly optional makeArgs: (state) => (entry) => HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
```

Builds invocation arguments for each registered helper.

#### Parameters

##### state

`TState`

#### Returns

```ts
(entry): HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
```

##### Parameters

###### entry

[`PipelineRegisteredHelper`](PipelineRegisteredHelper.md)<`THelper`>

##### Returns

[`HelperApplyOptions`](HelperApplyOptions.md)<`TContext`, `TInput`, `TOutput`, `TReporter`>

---

### onVisited()?

```ts
readonly optional onVisited: (state, visited, registered, rollbacks, output) => TState;
```

Observes execution and returns the state passed to the next stage.

#### Parameters

##### state

`TState`

##### visited

`ReadonlySet`<`string`>

##### registered

readonly [`PipelineRegisteredHelper`](PipelineRegisteredHelper.md)<`THelper`>[]

##### rollbacks

readonly [`PipelineHelperRollback`](PipelineHelperRollback.md)<`THelper`>[]

##### output

`TOutput`

#### Returns

`TState`

---

### writeOutput()?

```ts
readonly optional writeOutput: (state, output) => TState;
```

Adopts the chain's final output into stage state.

#### Parameters

##### state

`TState`

##### output

`TOutput`

#### Returns

`TState`
