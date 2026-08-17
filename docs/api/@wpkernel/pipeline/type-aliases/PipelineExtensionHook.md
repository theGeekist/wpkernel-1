[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineExtensionHook

# Type Alias: PipelineExtensionHook&lt;TContext, TOptions, TArtifact&gt;

```ts
type PipelineExtensionHook&lt;TContext, TOptions, TArtifact&gt; = (options) =&gt; MaybePromise&lt;
  | PipelineExtensionHookResult&lt;TArtifact&gt;
| void&gt;;
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

[`PipelineExtensionHookOptions`](../interfaces/PipelineExtensionHookOptions.md)&lt;`TContext`, `TOptions`, `TArtifact`&gt;

## Returns

[`MaybePromise`](MaybePromise.md)&lt;
  \| [`PipelineExtensionHookResult`](../interfaces/PipelineExtensionHookResult.md)&lt;`TArtifact`&gt;
  \| `void`&gt;

## Remarks

Hooks may remain synchronous or return a native promise. Hooks within one
lifecycle are awaited sequentially and observe the artifact returned by the
preceding hook.

## See

[PipelineExtensionHookResult](../interfaces/PipelineExtensionHookResult.md)
