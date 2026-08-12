[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExtension

# Interface: PipelineExtension<TPipeline, TContext, TOptions, TArtifact>

A pipeline extension descriptor.

Explicit keys must be unique within a pipeline instance. Omitting `key`
assigns a private generated key. Asynchronous registrations retain `use()`
call order regardless of the order in which registration promises settle.
A registration failure invalidates subsequent new runs.

## See

[PipelineExtensionHookRegistration](PipelineExtensionHookRegistration.md)

## Type Parameters

### TPipeline

`TPipeline`

Pipeline instance exposed during registration.

### TContext

`TContext`

Per-run context type used by the registered hook.

### TOptions

`TOptions`

Run-options type used by the registered hook.

### TArtifact

`TArtifact`

Artifact type exposed to the registered hook.

## Properties

### register()

```ts
register: (pipeline) =>
	MaybePromise<
		PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact>
	>;
```

Registers zero or one lifecycle hook for this extension.

Registration begins at `extensions.use()` time. A run waits for all
registrations already in flight to reach quiescence, then captures an
immutable hook snapshot.

#### Parameters

##### pipeline

`TPipeline`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<[`PipelineExtensionRegisterOutput`](../type-aliases/PipelineExtensionRegisterOutput.md)<`TContext`, `TOptions`, `TArtifact`>>

---

### key?

```ts
readonly optional key: string;
```

Stable identity used for ordering and rollback diagnostics.
