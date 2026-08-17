[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineExtensionHookOptions

# Interface: PipelineExtensionHookOptions&lt;TContext, TOptions, TArtifact&gt;

Immutable invocation data supplied to an extension hook.

## Type Parameters

### TContext

`TContext`

Context created for the current run.

### TOptions

`TOptions`

Original options supplied to the run.

### TArtifact

`TArtifact`

Extension-visible artifact at this lifecycle point.

## Properties

### artifact

```ts
readonly artifact: TArtifact;
```

Artifact after every preceding hook in this lifecycle has completed.

---

### context

```ts
readonly context: TContext;
```

Context shared by all stages, helpers and hooks in the run.

---

### lifecycle

```ts
readonly lifecycle: string;
```

Lifecycle currently being executed.

---

### options

```ts
readonly options: TOptions;
```

Original run options.
