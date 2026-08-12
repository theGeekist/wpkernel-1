[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineRegisteredHelper

# Interface: PipelineRegisteredHelper<THelper>

Registration metadata supplied to helper-stage argument factories.

## Type Parameters

### THelper

`THelper`

Concrete helper type stored in the selected registry.

## Properties

### helper

```ts
readonly helper: THelper;
```

Original registered helper object.

---

### id

```ts
readonly id: string;
```

Stable identity combining kind, key and registration index.

---

### index

```ts
readonly index: number;
```

Monotonic registration index within the kind.
