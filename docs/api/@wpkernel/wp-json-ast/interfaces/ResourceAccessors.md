[**@wpkernel/wp-json-ast v0.12.6-beta.3**](../index.md)

---

[@wpkernel/wp-json-ast](../index.md) / ResourceAccessors

# Interface: ResourceAccessors&lt;TStorageKind&gt;

## Type Parameters

### TStorageKind

`TStorageKind` _extends_ `string` = `string`

## Properties

### storages

```ts
readonly storages: readonly ResourceStorageAccessors&lt;TStorageKind&gt;[];
```

---

### storagesByKind

```ts
readonly storagesByKind: ReadonlyMap&lt;TStorageKind, ResourceStorageAccessors&lt;TStorageKind&gt;&gt;;
```
