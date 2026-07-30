[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageResult

# Type Alias: PipelineStageResult&lt;TState, TRunResult&gt;

```ts
type PipelineStageResult&lt;TState, TRunResult&gt; =
  | TState
  | PipelinePaused&lt;TState&gt;
| PipelineHalt&lt;TRunResult&gt;;
```

Result accepted from a custom pipeline stage.

## Type Parameters

### TState

`TState`

### TRunResult

`TRunResult`
