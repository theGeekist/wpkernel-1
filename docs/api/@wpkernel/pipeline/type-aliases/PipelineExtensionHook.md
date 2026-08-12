[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExtensionHook

# Type Alias: PipelineExtensionHook<TContext, TOptions, TArtifact>

```ts
type PipelineExtensionHook<TContext, TOptions, TArtifact> = (
	options
) => MaybePromise<PipelineExtensionHookResult<TArtifact> | void>;
```

A pipeline extension hook function.

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

## Parameters

### options

[`PipelineExtensionHookOptions`](../interfaces/PipelineExtensionHookOptions.md)<`TContext`, `TOptions`, `TArtifact`>

## Returns

[`MaybePromise`](MaybePromise.md)<
\| [`PipelineExtensionHookResult`](../interfaces/PipelineExtensionHookResult.md)<`TArtifact`>
\| `void`>

## Remarks

Hooks may remain synchronous or return a native promise. Hooks within one
lifecycle are awaited sequentially and observe the artifact returned by the
preceding hook.

## See

[PipelineExtensionHookResult](../interfaces/PipelineExtensionHookResult.md)
