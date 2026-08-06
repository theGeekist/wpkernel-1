[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageResult

# Type Alias: PipelineStageResult<TState, TRunResult>

```ts
type PipelineStageResult<TState, TRunResult> =
	| TState
	| PipelinePaused<TState>
	| PipelineHalt<TRunResult>;
```

Result accepted from a custom pipeline stage.

## Type Parameters

### TState

`TState`

### TRunResult

`TRunResult`
