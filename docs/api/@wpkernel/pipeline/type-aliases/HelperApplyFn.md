[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / HelperApplyFn

# Type Alias: HelperApplyFn<TContext, TInput, TOutput, TReporter>

```ts
type HelperApplyFn<TContext, TInput, TOutput, TReporter> = (
	options,
	next?
) => MaybePromise<HelperApplyResult<TOutput> | void>;
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

`TReporter` _extends_ [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

Reporter type.

## Parameters

### options

[`HelperApplyOptions`](../interfaces/HelperApplyOptions.md)<`TContext`, `TInput`, `TOutput`, `TReporter`>

Invocation context, input and current output.

### next?

[`HelperNext`](../interfaces/HelperNext.md)<`TOutput`>

Continuation for wrapping downstream helpers.

## Returns

[`MaybePromise`](MaybePromise.md)<
\| [`HelperApplyResult`](../interfaces/HelperApplyResult.md)<`TOutput`>
\| `void`>

A synchronous or asynchronous optional helper result.

## Remarks

A helper may mutate its output, return an immutable replacement, wrap the
remainder of the chain through [HelperNext](../interfaces/HelperNext.md), and register compensation
through [HelperApplyResult.rollback](../interfaces/HelperApplyResult.md#rollback). Returning `void` preserves the
current output and registers no rollback.
