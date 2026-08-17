[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineHelperRollback

# Interface: PipelineHelperRollback&lt;THelper&gt;

Helper and rollback pair captured after successful execution.

## Remarks

The pair retains helper identity so rollback-error observers receive the
exact helper whose compensation failed.

## Type Parameters

### THelper

`THelper`

Concrete helper type retained by identity.

## Properties

### helper

```ts
readonly helper: THelper;
```

Original helper that produced the rollback.

---

### rollback

```ts
readonly rollback: PipelineRollback;
```

Compensation registered by the helper result.
