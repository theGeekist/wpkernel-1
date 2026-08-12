[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / HelperApplyOptions

# Interface: HelperApplyOptions&lt;TContext, TInput, TOutput, TReporter&gt;

Immutable invocation envelope passed to a helper.

## Type Parameters

### TContext

`TContext`

Per-run context created by the pipeline.

### TInput

`TInput`

Stage-specific input supplied by the argument factory.

### TOutput

`TOutput`

Current transformation value.

### TReporter

`TReporter` *extends* [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

Reporter available both directly and through context.

## Properties

### context

```ts
readonly context: TContext;
```

Per-run services and capabilities.

***

### input

```ts
readonly input: TInput;
```

Read-only input selected for this helper phase.

***

### output

```ts
readonly output: TOutput;
```

Current output, including replacements produced upstream.

***

### reporter

```ts
readonly reporter: TReporter;
```

Reporter associated with the current run.
