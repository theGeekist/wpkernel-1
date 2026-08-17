[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/php-json-ast](../index.md) / Helper

# Interface: Helper&lt;TContext, TInput, TOutput, TReporter, TKind&gt;

Executable helper descriptor accepted by pipeline registration.

## Remarks

Helpers created by `createHelper` are frozen and retain their object identity
through registration and execution.

## See

- [HelperDescriptor](HelperDescriptor.md)
- [HelperApplyFn](../type-aliases/HelperApplyFn.md)

## Extends

- [`HelperDescriptor`](HelperDescriptor.md)&lt;`TKind`&gt;

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

Executes this helper when its dependency position is reached.

---

### dependsOn

```ts
readonly dependsOn: readonly string[];
```

Helper keys that must complete before this helper may execute.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`dependsOn`](HelperDescriptor.md#dependson)

---

### key

```ts
readonly key: string;
```

Dependency and override identity within [kind](HelperDescriptor.md#kind).

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`key`](HelperDescriptor.md#key)

---

### kind

```ts
readonly kind: TKind;
```

Execution phase and registry containing this helper.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`kind`](HelperDescriptor.md#kind)

---

### mode

```ts
readonly mode: HelperMode;
```

Duplicate-key registration policy.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`mode`](HelperDescriptor.md#mode)

---

### priority

```ts
readonly priority: number;
```

Relative ordering hint; higher values run first when dependencies permit.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`priority`](HelperDescriptor.md#priority)

---

### origin?

```ts
readonly optional origin: string;
```

Optional package or subsystem label used in diagnostics.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`origin`](HelperDescriptor.md#origin)
