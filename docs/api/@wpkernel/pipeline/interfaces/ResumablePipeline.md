[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / ResumablePipeline

# Interface: ResumablePipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TState, TKind&gt;

A resumable pipeline instance.

Paused results expose a process-local, single-use snapshot capability.
Resume the exact object with the same pipeline instance. Registrations made
after a pause apply to later new runs and do not delay or invalidate the
suspended run.

## Example

```ts
const result = await pipeline.run(options);
if ('paused' in result) {
  const resumed = await pipeline.resume(result.snapshot, userDecision);
}
```

## See

 - [PipelinePaused](PipelinePaused.md)
 - [PipelinePauseSnapshot](PipelinePauseSnapshot.md)

## Extends

- `PipelineBase`&lt;`TRunOptions`, `TContext`, `TReporter`, `ResumablePipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TState`, `TKind`&gt;, `TKind`&gt;

## Type Parameters

### TRunOptions

`TRunOptions`

Input accepted by [ResumablePipeline.run](#run).

### TRunResult

`TRunResult`

Successful terminal result.

### TContext

`TContext` *extends* `object`

Per-run context containing the reporter.

### TReporter

`TReporter` *extends* [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

Reporter exposed to helpers and diagnostics.

### TState

`TState` = `unknown`

Public state projection exposed by pause snapshots.

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

[`PipelineExtension`](PipelineExtension.md)&lt;`ResumablePipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TState`, `TKind`&gt;, `TContext`, `TRunOptions`, `unknown`&gt;

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

### resume()

```ts
resume: (snapshot, resumeInput?) =&gt; MaybePromise&lt;TRunResult | PipelinePaused&lt;TState&gt;&gt;;
```

Continues the suspended run represented by `snapshot`.

#### Parameters

##### snapshot

[`PipelinePauseSnapshot`](PipelinePauseSnapshot.md)&lt;`TState`&gt;

Process-local capability returned by a prior pause.

##### resumeInput?

`unknown`

Optional value exposed as `state.resumeInput` while the
                   paused stage is re-entered.

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TRunResult` \| [`PipelinePaused`](PipelinePaused.md)&lt;`TState`&gt;&gt;

#### Remarks

The exact snapshot object must be passed to the pipeline instance that
created it. A snapshot is consumed by the first resume attempt and cannot be
serialised, cloned, replayed or resumed concurrently. Execution re-enters
the paused stage with `resumeInput`; it may complete or pause again with a
fresh snapshot.

***

### run()

```ts
run: (options) =&gt; MaybePromise&lt;TRunResult | PipelinePaused&lt;TState&gt;&gt;;
```

Starts a new run.

#### Parameters

##### options

`TRunOptions`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TRunResult` \| [`PipelinePaused`](PipelinePaused.md)&lt;`TState`&gt;&gt;

A successful result, or a paused value containing the single-use
snapshot needed by [ResumablePipeline.resume](#resume).

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
