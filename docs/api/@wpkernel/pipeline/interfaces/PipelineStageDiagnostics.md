[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineStageDiagnostics

# Interface: PipelineStageDiagnostics<TDiagnostic, TKind>

Diagnostic capabilities available to custom stages.

## Type Parameters

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### flagUnusedHelper()

```ts
readonly flagUnusedHelper: (helper, kind, message, dependsOn?) => void;
```

#### Parameters

##### helper

[`HelperDescriptor`](HelperDescriptor.md)<`TKind`>

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
readonly record: (diagnostic) => void;
```

#### Parameters

##### diagnostic

`TDiagnostic`

#### Returns

`void`
