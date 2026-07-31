[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / ResumablePipeline

# Interface: ResumablePipeline<TRunOptions, TRunResult, TContext, TReporter, TState>

A resumable pipeline instance.

## Extends

- `PipelineBase`<`TRunOptions`, `TContext`, `TReporter`, `ResumablePipeline`<`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TState`>>

## Type Parameters

### TRunOptions

`TRunOptions`

### TRunResult

`TRunResult`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](PipelineReporter.md) = [`PipelineReporter`](PipelineReporter.md)

### TState

`TState` = `unknown`

## Properties

### extensions

```ts
readonly extensions: object;
```

#### use()

```ts
use: (extension) => unknown;
```

##### Parameters

###### extension

[`PipelineExtension`](PipelineExtension.md)<`ResumablePipeline`<`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TState`>, `TContext`, `TRunOptions`, `unknown`>

##### Returns

`unknown`

#### Inherited from

```ts
PipelineBase.extensions;
```

---

### resume()

```ts
resume: (snapshot, resumeInput?) => MaybePromise<TRunResult | PipelinePaused<TState>>;
```

#### Parameters

##### snapshot

[`PipelinePauseSnapshot`](PipelinePauseSnapshot.md)<`TState`>

##### resumeInput?

`unknown`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`TRunResult` \| [`PipelinePaused`](PipelinePaused.md)<`TState`>>

---

### run()

```ts
run: (options) => MaybePromise<TRunResult | PipelinePaused<TState>>;
```

#### Parameters

##### options

`TRunOptions`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`TRunResult` \| [`PipelinePaused`](PipelinePaused.md)<`TState`>>

---

### use()

```ts
use: <TInput, TOutput, TKind>(helper) => void;
```

Generic helper registration.

#### Type Parameters

##### TInput

`TInput`

##### TOutput

`TOutput`

##### TKind

`TKind` _extends_ `string`

#### Parameters

##### helper

[`Helper`](Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`>

#### Returns

`void`

#### Inherited from

```ts
PipelineBase.use;
```

---

### providedKeys?

```ts
readonly optional providedKeys: Record<string, readonly string[]>;
```

Map of helper keys that should be treated as "already satisfied" for dependency resolution.
Keys are grouped by helper kind.

#### Inherited from

```ts
PipelineBase.providedKeys;
```
