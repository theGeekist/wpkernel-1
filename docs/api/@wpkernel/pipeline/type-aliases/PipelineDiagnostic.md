[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineDiagnostic

# Type Alias: PipelineDiagnostic&lt;TKind&gt;

```ts
type PipelineDiagnostic&lt;TKind&gt; =
  | ConflictDiagnostic&lt;TKind&gt;
  | MissingDependencyDiagnostic&lt;TKind&gt;
| UnusedHelperDiagnostic&lt;TKind&gt;;
```

Built-in discriminated union of registration and execution diagnostics.

## Type Parameters

### TKind

`TKind` *extends* [`HelperKind`](HelperKind.md) = [`HelperKind`](HelperKind.md)

Helper-kind union represented by the diagnostics.
