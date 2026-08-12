[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / AgnosticPipeline

# Interface: AgnosticPipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TKind&gt;

Executable, non-suspending pipeline instance.

## Remarks

Each call creates fresh context and state, waits for pending extension
registration, captures the applicable registrations, then executes stages in
order. The return remains synchronous when the complete run is synchronous;
asynchronous helpers, hooks or stages promote it to a promise. Failures run
available compensation before they are rethrown or rejected.

## See

 - [AgnosticPipelineOptions](../type-aliases/AgnosticPipelineOptions.md)
 - [ResumablePipeline](ResumablePipeline.md)

## Extends

- `PipelineBase`&lt;`TRunOptions`, `TContext`, `TReporter`, `AgnosticPipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TKind`&gt;, `TKind`&gt;

## Type Parameters

### TRunOptions

`TRunOptions`

Input accepted by the pipeline's `run` method.

### TRunResult

`TRunResult`

Successful terminal result.

### TContext

`TContext` *extends* `object`

Per-run context containing the reporter.

### TReporter

`TReporter` *extends* [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

Reporter exposed to helpers and diagnostics.

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Configured helper-kind union accepted by `use`.

## Properties

### extensions

```ts
readonly extensions: object;
```

Extension registration namespace.

#### use()

```ts
use: (extension) =&gt; unknown;
```

Registers an extension. A run waits until registration reaches
quiescence, then captures an immutable hook snapshot for that run.

##### Parameters

###### extension

[`PipelineExtension`](PipelineExtension.md)&lt;`AgnosticPipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TKind`&gt;, `TContext`, `TRunOptions`, `unknown`&gt;

##### Returns

`unknown`

##### Remarks

Calls are ordered by invocation, not asynchronous settlement. Explicit
duplicate extension keys and registration failures invalidate subsequent
new runs. An extension without an explicit key receives a private generated
identity.

##### See

[PipelineExtension](PipelineExtension.md)

#### Inherited from

```ts
PipelineBase.extensions
```

***

### run()

```ts
run: (options) =&gt; MaybePromise&lt;TRunResult&gt;;
```

Executes one run after pending extension registrations reach quiescence.

#### Parameters

##### options

`TRunOptions`

Immutable input used to create context, state and result.

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TRunResult`&gt;

The configured result directly for a synchronous run, otherwise a
promise for that result.

***

### use()

```ts
use: &lt;TInput, TOutput&gt;(helper) =&gt; void;
```

Registers a helper whose kind is one of the kinds configured at
construction. Registration preserves the helper object's identity.

#### Type Parameters

##### TInput

`TInput`

##### TOutput

`TOutput`

#### Parameters

##### helper

[`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`&gt;

#### Returns

`void`

#### Remarks

Helper dependency and conflict resolution occurs when its helper stage
executes, not at registration time. The configured `TKind` union prevents
accidental registration of helper kinds that the pipeline cannot schedule.

#### See

[Helper](Helper.md)

#### Inherited from

```ts
PipelineBase.use
```
