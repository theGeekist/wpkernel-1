[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / Halt

# Type Alias: Halt<TRunResult>

```ts
type Halt<TRunResult> = PipelineHalt<TRunResult>;
```

Concise alias for a terminal stage result.

An error halt triggers rollback and rejects with its `error`. A result halt
settles successfully with its `result`; a bare halt settles successfully
with `undefined`. When both fields are present, the error is authoritative.

## Type Parameters

### TRunResult

`TRunResult`

Successful pipeline result carried by a result halt.

## See

[PipelineHalt](PipelineHalt.md)
