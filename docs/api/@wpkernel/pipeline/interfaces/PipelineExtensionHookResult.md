[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExtensionHookResult

# Interface: PipelineExtensionHookResult<TArtifact>

Result from a pipeline extension hook.

## Remarks

All members are optional. Returning `void` or omitting `artifact` preserves
the current artifact. Commit and rollback callbacks describe side effects
prepared by the hook. The runner commits them in forward execution order on
successful settlement and rolls them back in reverse order after failure.

## Type Parameters

### TArtifact

`TArtifact`

Extension-visible artifact type.

## Properties

### artifact?

```ts
readonly optional artifact: TArtifact;
```

Replacement artifact passed to the next hook and written back to state.

---

### commit()?

```ts
readonly optional commit: () => MaybePromise<void>;
```

Finalises the hook's prepared side effect after successful execution.

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`void`>

---

### rollback()?

```ts
readonly optional rollback: () => MaybePromise<void>;
```

Compensates the hook's prepared side effect after failure.

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`void`>
