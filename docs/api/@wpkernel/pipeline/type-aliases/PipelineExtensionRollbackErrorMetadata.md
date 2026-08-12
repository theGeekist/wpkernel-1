[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExtensionRollbackErrorMetadata

# Type Alias: PipelineExtensionRollbackErrorMetadata

```ts
type PipelineExtensionRollbackErrorMetadata = PipelineRollbackErrorMetadata;
```

Metadata about an error during extension rollback.

## Remarks

The metadata describes the original run failure and the rollback callback
whose own failure is being reported. It is shared with helper rollback
observers so both mechanisms expose the same chronology vocabulary.

## See

[PipelineRollbackErrorMetadata](../interfaces/PipelineRollbackErrorMetadata.md)
