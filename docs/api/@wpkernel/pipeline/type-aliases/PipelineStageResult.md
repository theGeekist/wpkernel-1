[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageResult

# Type Alias: PipelineStageResult<TState, TRunResult>

```ts
type PipelineStageResult<TState, TRunResult> =
	| TState
	| PipelinePaused<TState>
	| PipelineHalt<TRunResult>;
```

Complete result union accepted from a custom stage.

## Type Parameters

### TState

`TState`

State passed between stages.

### TRunResult

`TRunResult`

Successful halt result type.

## Remarks

A stage either continues with state, suspends through
[PipelinePaused](../interfaces/PipelinePaused.md), or terminates through [PipelineHalt](PipelineHalt.md).
