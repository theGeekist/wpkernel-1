[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / PipelineExtensionHook

# Type Alias: PipelineExtensionHook

```ts
type PipelineExtensionHook = (options) =&gt; MaybePromise&lt;
  | PipelineExtensionHookResult
| void&gt;;
```

Represents a pipeline extension hook function.

## Parameters

### options

[`PipelineExtensionHookOptions`](PipelineExtensionHookOptions.md)

## Returns

`MaybePromise`&lt;
  \| [`PipelineExtensionHookResult`](../interfaces/PipelineExtensionHookResult.md)
  \| `void`&gt;
