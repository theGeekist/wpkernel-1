[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

---

[@wpkernel/cli](../index.md) / CreateHelperOptions

# Interface: CreateHelperOptions&lt;TContext, TInput, TOutput, TReporter, TKind&gt;

Input accepted by `createHelper`.

## Remarks

Omitted metadata is normalised to `mode: 'extend'`, `priority: 0`, and an
empty dependency list. The dependency list is copied and frozen.

## Type Parameters

### TContext

`TContext`

Per-run context type.

### TInput

`TInput`

Phase-specific input type.

### TOutput

`TOutput`

Value transformed by the helper chain.

### TReporter

`TReporter` _extends_ `PipelineReporter` = `PipelineReporter`

Reporter type available during execution.

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Literal helper kind represented by the descriptor.

## Properties

### apply

```ts
readonly apply: HelperApplyFn&lt;TContext, TInput, TOutput, TReporter&gt;;
```

Helper implementation.

---

### key

```ts
readonly key: string;
```

Dependency and override identity within the helper kind.

---

### kind

```ts
readonly kind: TKind;
```

Pipeline phase in which the helper executes.

---

### dependsOn?

```ts
readonly optional dependsOn: readonly string[];
```

Prerequisite helper keys.

#### Default Value

`[]`

---

### mode?

```ts
readonly optional mode: HelperMode;
```

Duplicate-key policy.

#### Default Value

`'extend'`

---

### origin?

```ts
readonly optional origin: string;
```

Optional provenance label used in diagnostics.

---

### priority?

```ts
readonly optional priority: number;
```

Relative ordering hint.

#### Default Value

`0`
