[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / PipelineExecutionMetadata

# Interface: PipelineExecutionMetadata<TFragmentKind, TBuilderKind>

Complete helper execution metadata supplied to a custom run-result adapter.

Fragment metadata is captured before draft finalisation. Builder metadata is
captured after the final builder helper and therefore describes the whole
standard helper sequence.

## Extends

- [`FragmentFinalizationMetadata`](FragmentFinalizationMetadata.md)<`TFragmentKind`>

## Type Parameters

### TFragmentKind

`TFragmentKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

### TBuilderKind

`TBuilderKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### builders

```ts
readonly builders: HelperExecutionSnapshot<TBuilderKind>;
```

Snapshot of builder helper resolution and execution for this run.

---

### fragments

```ts
readonly fragments: HelperExecutionSnapshot<TFragmentKind>;
```

Snapshot of fragment helper resolution and execution for this run.

#### Inherited from

[`FragmentFinalizationMetadata`](FragmentFinalizationMetadata.md).[`fragments`](FragmentFinalizationMetadata.md#fragments)
