[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStage

# Type Alias: PipelineStage&lt;TState, TRunResult&gt;

```ts
type PipelineStage&lt;TState, TRunResult&gt; = (state) =&gt; MaybePromise&lt;PipelineStageResult&lt;TState, TRunResult&gt;&gt;;
```

A synchronous-or-asynchronous custom pipeline stage.

## Type Parameters

### TState

`TState`

### TRunResult

`TRunResult`

## Parameters

### state

`TState`

## Returns

[`MaybePromise`](MaybePromise.md)&lt;[`PipelineStageResult`](PipelineStageResult.md)&lt;`TState`, `TRunResult`&gt;&gt;
