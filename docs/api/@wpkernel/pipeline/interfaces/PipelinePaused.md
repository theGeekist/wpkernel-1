[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelinePaused

# Interface: PipelinePaused&lt;TState&gt;

Discriminated result indicating that a resumable run suspended.

## See

[ResumablePipeline.resume](ResumablePipeline.md#resume)

## Type Parameters

### TState

`TState`

Public stage-state projection captured by the snapshot.

## Properties

### \_\_paused

```ts
readonly __paused: true;
```

Runtime discriminant.

***

### snapshot

```ts
readonly snapshot: PipelinePauseSnapshot&lt;TState&gt;;
```

Single-use capability required to resume the run.
