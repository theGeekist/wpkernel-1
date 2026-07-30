[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineHelperStageOptions

# Interface: PipelineHelperStageOptions&lt;TState, TContext, TInput, TOutput, TReporter, TKind, THelper&gt;

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

`THelper` _extends_ [`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`&gt;

## Properties

### makeArgs()?

```ts
readonly optional makeArgs: (state) =&gt; (entry) =&gt; HelperApplyOptions&lt;TContext, TInput, TOutput, TReporter&gt;;
```

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

---

### onVisited()?

```ts
readonly optional onVisited: (state, visited, registered, rollbacks, output) =&gt; TState;
```

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

---

### writeOutput()?

```ts
readonly optional writeOutput: (state, output) =&gt; TState;
```

#### Parameters

##### state

`TState`

##### output

`TOutput`

#### Returns

`TState`
