[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExtensionHookRegistration

# Interface: PipelineExtensionHookRegistration<TContext, TOptions, TArtifact>

Hook registration returned by an extension.

## Remarks

Omitting `lifecycle` registers the hook at the runner's default lifecycle,
`after-fragments`. The lifecycle must be present in the pipeline's configured
lifecycle set to execute.

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

## Properties

### hook

```ts
readonly hook: PipelineExtensionHook<TContext, TOptions, TArtifact>;
```

Hook invoked when the selected lifecycle stage executes.

---

### lifecycle?

```ts
readonly optional lifecycle: string;
```

Lifecycle at which the hook executes. Defaults to `after-fragments`.
