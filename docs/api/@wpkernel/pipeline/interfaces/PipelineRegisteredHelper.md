[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineRegisteredHelper

# Interface: PipelineRegisteredHelper&lt;THelper&gt;

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
