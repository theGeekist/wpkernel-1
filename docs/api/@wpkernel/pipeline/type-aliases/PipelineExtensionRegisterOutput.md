[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExtensionRegisterOutput

# Type Alias: PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact>

```ts
type PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact> =
	| void
	| PipelineExtensionHook<TContext, TOptions, TArtifact>
	| PipelineExtensionHookRegistration<TContext, TOptions, TArtifact>;
```

Value returned by extension registration: no hook, a hook using the default
lifecycle, or an explicit lifecycle registration.

## Type Parameters

### TContext

`TContext`

Per-run context type.

### TOptions

`TOptions`

Run-options type.

### TArtifact

`TArtifact`

Extension-visible artifact type.
