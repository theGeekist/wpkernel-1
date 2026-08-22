[**@wpkernel/cli v0.12.6-beta.3**](../index.md)

***

[@wpkernel/cli](../index.md) / HelperKind

# Type Alias: HelperKind

```ts
type HelperKind = string;
```

Identifier for a helper execution phase, such as `fragment` or `builder`.

## Remarks

A serial programme accepts the fragment and builder kinds declared through
`CreateSerialPipelineOptions`. Dependencies are resolved within one kind,
never across the two registries.
