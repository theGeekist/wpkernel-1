[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / HelperKind

# Type Alias: HelperKind

```ts
type HelperKind = string;
```

Identifier for a helper execution phase, such as `fragment` or `builder`.

## Remarks

A pipeline accepts only the kinds declared in
`AgnosticPipelineOptions.helperKinds`. Dependencies are resolved within
one kind, never across kind registries.
