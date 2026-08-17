[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelinePauseKind

# Type Alias: PipelinePauseKind

```ts
type PipelinePauseKind = string;
```

Application-defined classification for a pause boundary.

## Remarks

The runtime does not interpret pause kinds. Consumers may use them to route
process-local resumptions or discriminate payloads.
