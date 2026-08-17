[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineReporter

# Interface: PipelineReporter

Minimal observer used by the pipeline for non-fatal warnings.

## Remarks

Reporting is observational. Reporter failures are contained and do not alter
registration, execution, rollback or run settlement.

## Properties

### warn()?

```ts
optional warn: (message, context?) =&gt; void;
```

Receives a human-readable warning and optional structured context.

#### Parameters

##### message

`string`

##### context?

`unknown`

#### Returns

`void`
