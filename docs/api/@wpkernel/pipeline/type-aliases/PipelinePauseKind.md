[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelinePauseKind

# Type Alias: PipelinePauseKind

```ts
type PipelinePauseKind = string;
```

Application-defined classification for a pause boundary.

## Remarks

The runtime does not interpret pause kinds. Consumers may use them to route
process-local resumptions or discriminate payloads.
