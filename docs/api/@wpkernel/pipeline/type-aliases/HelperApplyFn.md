[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / HelperApplyFn

# Type Alias: HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt;

```ts
type HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt; = (options, next?) =&gt; MaybePromise&lt;
  | HelperApplyResult&lt;TOutput&gt;
| void&gt;;
```

Function signature for a pipeline helper's apply method.

This function is responsible for transforming the pipeline's input and output.
It can optionally call `next()` to wrap the remainder of the helper chain.

Helpers can also return a result object with transformed output and optional rollback
for cleanup if the pipeline fails after the helper executes.

## Type Parameters

### TContext

`TContext`

The type of the pipeline context.

### TInput

`TInput`

The type of the input artifact.

### TOutput

`TOutput`

The type of the output artifact.

### TReporter

`TReporter` _extends_ [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

The type of the reporter used for logging.

## Parameters

### options

[`HelperApplyOptions`](../interfaces/HelperApplyOptions.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`&gt;

Options for the apply function, including context, input, output, and reporter.

### next?

[`HelperNext`](../interfaces/HelperNext.md)&lt;`TOutput`&gt;

Optional continuation that returns the downstream output.

## Returns

[`MaybePromise`](MaybePromise.md)&lt;
\| [`HelperApplyResult`](../interfaces/HelperApplyResult.md)&lt;`TOutput`&gt;
\| `void`&gt;

A promise that resolves when the helper has finished its work, or a result object with optional output and rollback.
