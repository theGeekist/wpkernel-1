[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineDiagnostic

# Type Alias: PipelineDiagnostic<TKind>

```ts
type PipelineDiagnostic<TKind> =
	| ConflictDiagnostic<TKind>
	| MissingDependencyDiagnostic<TKind>
	| UnusedHelperDiagnostic<TKind>;
```

Built-in discriminated union of registration and execution diagnostics.

## Type Parameters

### TKind

`TKind` _extends_ [`HelperKind`](HelperKind.md) = [`HelperKind`](HelperKind.md)

Helper-kind union represented by the diagnostics.
