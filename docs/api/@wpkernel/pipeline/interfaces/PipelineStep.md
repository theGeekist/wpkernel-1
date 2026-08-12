[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStep

# Interface: PipelineStep<TKind>

Immutable public record of one executed helper.

## Remarks

Steps contain flattened descriptor metadata, not the helper object or its
executable function.

## Extends

- [`HelperDescriptor`](HelperDescriptor.md)<`TKind`>

## Type Parameters

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Helper-kind union represented by the step.

## Properties

### dependsOn

```ts
readonly dependsOn: readonly string[];
```

Helper keys that must complete before this helper may execute.

#### Inherited from

[`HelperDescriptor`](HelperDescriptor.md).[`dependsOn`](HelperDescriptor.md#dependson)

---

### id

```ts
readonly id: string;
```

Run-stable registration identity.

---

### index

```ts
readonly index: number;
```

Monotonic registration index within the helper kind.

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
