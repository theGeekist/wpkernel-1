[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / HelperApplyFn

# Type Alias: HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt;

```ts
type HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt; = (options, next?) =&gt; MaybePromise&lt;
  | HelperApplyResult&lt;TOutput&gt;
| void&gt;;
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

`TReporter` *extends* [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

Reporter type.

## Parameters

### options

[`HelperApplyOptions`](../interfaces/HelperApplyOptions.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`&gt;

Invocation context, input and current output.

### next?

[`HelperNext`](../interfaces/HelperNext.md)&lt;`TOutput`&gt;

Continuation for wrapping downstream helpers.

## Returns

[`MaybePromise`](MaybePromise.md)&lt;
  \| [`HelperApplyResult`](../interfaces/HelperApplyResult.md)&lt;`TOutput`&gt;
  \| `void`&gt;

A synchronous or asynchronous optional helper result.

## Remarks

A helper may mutate its output, return an immutable replacement, wrap the
remainder of the chain through [HelperNext](../interfaces/HelperNext.md), and register compensation
through [HelperApplyResult.rollback](../interfaces/HelperApplyResult.md#rollback). Returning `void` preserves the
current output and registers no rollback.
