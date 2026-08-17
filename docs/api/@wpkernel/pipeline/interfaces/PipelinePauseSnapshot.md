[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelinePauseSnapshot

# Interface: PipelinePauseSnapshot&lt;TState&gt;

Snapshot captured when a pipeline run pauses.

A snapshot is a process-local, single-use capability owned by the resumable
pipeline instance that created it. Pass the exact snapshot object back to
that instance's `resume()` method. A copied, forged, foreign, previously
resumed, or concurrently resumed snapshot is rejected.

`state` is a public projection for inspection. The runner retains the
authoritative continuation and transaction state privately. Neither the
snapshot nor its state is a serializable or durable workflow checkpoint.

## See

[ResumablePipeline.resume](ResumablePipeline.md#resume)

## Type Parameters

### TState

`TState`

Public state projection available for inspection.

## Properties

### createdAt

```ts
readonly createdAt: number;
```

Epoch timestamp in milliseconds when the pause was created.

***

### stageIndex

```ts
readonly stageIndex: number;
```

Index of the stage that requested the pause and will be re-entered.

***

### state

```ts
readonly state: TState;
```

Read-only public projection of the suspended stage state.

***

### pauseKind?

```ts
readonly optional pauseKind: string;
```

Application-defined pause classification.

***

### payload?

```ts
readonly optional payload: unknown;
```

Consumer-owned pause payload.

***

### token?

```ts
readonly optional token: unknown;
```

Consumer-owned correlation value copied from pause options.
