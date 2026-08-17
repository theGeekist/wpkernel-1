[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineStageDiagnostics

# Interface: PipelineStageDiagnostics&lt;TDiagnostic, TKind&gt;

Diagnostic capabilities available while composing custom stages.

## Remarks

Recorded diagnostics are appended to the current run and synchronously
offered to `onDiagnostic`. Observer failures are contained.

## Type Parameters

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

Diagnostic union accepted by the pipeline.

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md)

Configured helper-kind union.

## Properties

### flagUnusedHelper()

```ts
readonly flagUnusedHelper: (helper, kind, message, dependsOn?) =&gt; void;
```

Records a standard unused-helper diagnostic.

#### Parameters

##### helper

[`HelperDescriptor`](HelperDescriptor.md)&lt;`TKind`&gt;

##### kind

`TKind`

##### message

`string`

##### dependsOn?

readonly `string`[]

#### Returns

`void`

---

### record()

```ts
readonly record: (diagnostic) =&gt; void;
```

Adds a fully constructed diagnostic to the current run.

#### Parameters

##### diagnostic

`TDiagnostic`

#### Returns

`void`
