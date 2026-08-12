[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineExtensionRegisterOutput

# Type Alias: PipelineExtensionRegisterOutput&lt;TContext, TOptions, TArtifact&gt;

```ts
type PipelineExtensionRegisterOutput&lt;TContext, TOptions, TArtifact&gt; =
  | void
  | PipelineExtensionHook&lt;TContext, TOptions, TArtifact&gt;
| PipelineExtensionHookRegistration&lt;TContext, TOptions, TArtifact&gt;;
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
