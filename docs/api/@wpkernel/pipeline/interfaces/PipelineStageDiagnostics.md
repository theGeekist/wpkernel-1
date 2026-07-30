[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageDiagnostics

# Interface: PipelineStageDiagnostics&lt;TDiagnostic, TKind&gt;

Diagnostic capabilities available to custom stages.

## Type Parameters

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### flagUnusedHelper()

```ts
readonly flagUnusedHelper: (helper, kind, message, dependsOn?) =&gt; void;
```

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

#### Parameters

##### diagnostic

`TDiagnostic`

#### Returns

`void`
