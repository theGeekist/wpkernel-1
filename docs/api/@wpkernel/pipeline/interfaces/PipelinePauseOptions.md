[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelinePauseOptions

# Interface: PipelinePauseOptions

Metadata attached to a resumable pause.

## Remarks

All values are process-local metadata. They are not serialised, cloned or
validated by the pipeline.

## See

[PipelinePauseSnapshot](PipelinePauseSnapshot.md)

## Properties

### pauseKind?

```ts
readonly optional pauseKind: string;
```

Application-defined pause classification.

---

### payload?

```ts
readonly optional payload: unknown;
```

Application-defined data needed to decide how to resume.

---

### token?

```ts
readonly optional token: unknown;
```

Consumer-owned correlation value.
