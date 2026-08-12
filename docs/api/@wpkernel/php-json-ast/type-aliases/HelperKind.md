[**@wpkernel/php-json-ast v0.12.6-beta.3**](../README.md)

***

[@wpkernel/php-json-ast](../README.md) / HelperKind

# Type Alias: HelperKind

```ts
type HelperKind = string;
```

Identifier for a helper execution phase, such as `fragment` or `builder`.

## Remarks

A pipeline accepts only the kinds declared in
`AgnosticPipelineOptions.helperKinds`. Dependencies are resolved within
one kind, never across kind registries.
