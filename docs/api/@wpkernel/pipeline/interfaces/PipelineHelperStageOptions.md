[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineHelperStageOptions

# Interface: PipelineHelperStageOptions<TState, TContext, TInput, TOutput, TReporter, TKind, THelper>

Options for constructing a typed helper stage.

## Type Parameters

### TState

`TState`

### TContext

`TContext`

### TInput

`TInput`

### TOutput

`TOutput`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md)

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md)

### THelper

`THelper` _extends_ [`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`>

## Properties

### makeArgs()?

```ts
readonly optional makeArgs: (state) => (entry) => HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
```

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

#### Parameters

##### state

`TState`

##### output

`TOutput`

#### Returns

`TState`
