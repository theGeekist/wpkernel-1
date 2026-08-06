[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStage

# Type Alias: PipelineStage<TState, TRunResult>

```ts
type PipelineStage<TState, TRunResult> = (
	state
) => MaybePromise<PipelineStageResult<TState, TRunResult>>;
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

[`MaybePromise`](MaybePromise.md)<[`PipelineStageResult`](PipelineStageResult.md)<`TState`, `TRunResult`>>
