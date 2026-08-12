[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / CreatePipelineExtensionOptions

# Type Alias: CreatePipelineExtensionOptions<TPipeline, TContext, TOptions, TArtifact>

```ts
type CreatePipelineExtensionOptions<TPipeline, TContext, TOptions, TArtifact> =
	| CreatePipelineExtensionWithRegister<
			TPipeline,
			TContext,
			TOptions,
			TArtifact
	  >
	| CreatePipelineExtensionWithSetup<
			TPipeline,
			TContext,
			TOptions,
			TArtifact
	  >;
```

Configuration accepted by [createPipelineExtension](../functions/createPipelineExtension.md).

The dynamic form exposes `register`, which returns zero or one hook after any
setup completes. The static form runs `setup` first and then exposes `hook`.
If a static hook registration object and the outer options both specify a
lifecycle, the registration object's lifecycle wins. With neither value, the
receiving pipeline chooses its default lifecycle.

Both forms preserve synchronous registration when their setup is
synchronous. Once setup returns a safely inspectable thenable, hook
resolution is asynchronous through [maybeThen](../functions/maybeThen.md).

## Type Parameters

### TPipeline

`TPipeline`

### TContext

`TContext`

### TOptions

`TOptions`

### TArtifact

`TArtifact`
