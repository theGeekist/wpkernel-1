[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / ResumablePipeline

# Interface: ResumablePipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TState&gt;

A resumable pipeline instance.

## Extends

- `PipelineBase`&lt;`TRunOptions`, `TContext`, `TReporter`, `ResumablePipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TState`&gt;&gt;

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
use: (extension) =&gt; unknown;
```

##### Parameters

###### extension

[`PipelineExtension`](PipelineExtension.md)&lt;`ResumablePipeline`&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TState`&gt;, `TContext`, `TRunOptions`, `unknown`&gt;

##### Returns

`unknown`

#### Inherited from

```ts
PipelineBase.extensions;
```

---

### resume()

```ts
resume: (snapshot, resumeInput?) =&gt; MaybePromise&lt;TRunResult | PipelinePaused&lt;TState&gt;&gt;;
```

#### Parameters

##### snapshot

[`PipelinePauseSnapshot`](PipelinePauseSnapshot.md)&lt;`TState`&gt;

##### resumeInput?

`unknown`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TRunResult` \| [`PipelinePaused`](PipelinePaused.md)&lt;`TState`&gt;&gt;

---

### run()

```ts
run: (options) =&gt; MaybePromise&lt;TRunResult | PipelinePaused&lt;TState&gt;&gt;;
```

#### Parameters

##### options

`TRunOptions`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TRunResult` \| [`PipelinePaused`](PipelinePaused.md)&lt;`TState`&gt;&gt;

---

### use()

```ts
use: &lt;TInput, TOutput, TKind&gt;(helper) =&gt; void;
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

[`Helper`](Helper.md)&lt;`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`&gt;

#### Returns

`void`

#### Inherited from

```ts
PipelineBase.use;
```

---

### providedKeys?

```ts
readonly optional providedKeys: Record&lt;string, readonly string[]&gt;;
```

Map of helper keys that should be treated as "already satisfied" for dependency resolution.
Keys are grouped by helper kind.

#### Inherited from

```ts
PipelineBase.providedKeys;
```
