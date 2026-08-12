[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / HelperDescriptor

# Interface: HelperDescriptor&lt;TKind&gt;

Stable metadata used to register, order and diagnose a helper.

## Remarks

Keys identify dependency targets within a helper kind. Dependency ordering
takes precedence over priority. Among otherwise ready helpers, higher
priority runs first, then key order, then registration order.

## Extended by

- [`Helper`](Helper.md)
- [`PipelineStep`](PipelineStep.md)

## Type Parameters

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Literal union of helper kinds accepted by the pipeline.

## Properties

### dependsOn

```ts
readonly dependsOn: readonly string[];
```

Helper keys that must complete before this helper may execute.

***

### key

```ts
readonly key: string;
```

Dependency and override identity within [kind](#kind).

***

### kind

```ts
readonly kind: TKind;
```

Execution phase and registry containing this helper.

***

### mode

```ts
readonly mode: HelperMode;
```

Duplicate-key registration policy.

***

### priority

```ts
readonly priority: number;
```

Relative ordering hint; higher values run first when dependencies permit.

***

### origin?

```ts
readonly optional origin: string;
```

Optional package or subsystem label used in diagnostics.
