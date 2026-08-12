[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / HelperKind

# Type Alias: HelperKind

```ts
type HelperKind = string;
```

Identifier for a helper execution phase, such as `fragment` or `builder`.

## Remarks

A pipeline accepts only the kinds declared in
`AgnosticPipelineOptions.helperKinds`. Dependencies are resolved within
one kind, never across kind registries.
