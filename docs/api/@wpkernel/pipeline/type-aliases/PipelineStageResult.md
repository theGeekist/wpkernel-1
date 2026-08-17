[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineStageResult

# Type Alias: PipelineStageResult&lt;TState, TRunResult&gt;

```ts
type PipelineStageResult&lt;TState, TRunResult&gt; =
  | TState
  | PipelinePaused&lt;TState&gt;
| PipelineHalt&lt;TRunResult&gt;;
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
