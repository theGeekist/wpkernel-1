[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / Halt

# Type Alias: Halt&lt;TRunResult&gt;

```ts
type Halt&lt;TRunResult&gt; = PipelineHalt&lt;TRunResult&gt;;
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
