[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineStage

# Type Alias: PipelineStage&lt;TState, TRunResult&gt;

```ts
type PipelineStage&lt;TState, TRunResult&gt; = (state) =&gt; MaybePromise&lt;PipelineStageResult&lt;TState, TRunResult&gt;&gt;;
```

Synchronous-or-asynchronous unit in a custom stage composition.

## Type Parameters

### TState

`TState`

Stage-state facade.

### TRunResult

`TRunResult`

Successful early-result type.

## Parameters

### state

`TState`

## Returns

[`MaybePromise`](MaybePromise.md)&lt;[`PipelineStageResult`](PipelineStageResult.md)&lt;`TState`, `TRunResult`&gt;&gt;

## Remarks

Stages run sequentially in array order. A returned state is adopted before
the next stage. A pause or halt short-circuits the remaining composition.
Thrown and rejected errors initiate rollback.
