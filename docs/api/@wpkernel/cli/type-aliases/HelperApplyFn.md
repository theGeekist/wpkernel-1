[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / HelperApplyFn

# Type Alias: HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt;

```ts
type HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt; = (options, next?) =&gt; MaybePromise&lt;HelperApplyResult&lt;TOutput&gt; | void&gt;;
```

Transformation invoked for one registered helper.

## Type Parameters

### TContext

`TContext`

Per-run context type.

### TInput

`TInput`

Helper input type.

### TOutput

`TOutput`

Helper output type.

### TReporter

`TReporter` *extends* `PipelineReporter` = `PipelineReporter`

Reporter type.

## Parameters

### options

[`HelperApplyOptions`](../interfaces/HelperApplyOptions.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`&gt;

Invocation context, input and current output.

### next?

`HelperNext`&lt;`TOutput`&gt;

Continuation for wrapping downstream helpers.

## Returns

`MaybePromise`&lt;`HelperApplyResult`&lt;`TOutput`&gt; \| `void`&gt;

A synchronous or asynchronous optional helper result.

## Remarks

A helper may mutate its output, return an immutable replacement, wrap the
remainder of the chain through HelperNext, and register compensation
through HelperApplyResult.rollback. Returning `void` preserves the
current output and registers no rollback.
