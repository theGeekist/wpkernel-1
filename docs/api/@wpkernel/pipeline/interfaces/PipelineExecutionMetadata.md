[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineExecutionMetadata

# Interface: PipelineExecutionMetadata&lt;TFragmentKind, TBuilderKind&gt;

Complete helper execution metadata supplied to a custom run-result adapter.

Fragment metadata is captured before draft finalisation. Builder metadata is
captured after the final builder helper and therefore describes the whole
standard helper sequence.

## Extends

- [`FragmentFinalizationMetadata`](FragmentFinalizationMetadata.md)&lt;`TFragmentKind`&gt;

## Type Parameters

### TFragmentKind

`TFragmentKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

### TBuilderKind

`TBuilderKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### builders

```ts
readonly builders: HelperExecutionSnapshot&lt;TBuilderKind&gt;;
```

Snapshot of builder helper resolution and execution for this run.

***

### fragments

```ts
readonly fragments: HelperExecutionSnapshot&lt;TFragmentKind&gt;;
```

Snapshot of fragment helper resolution and execution for this run.

#### Inherited from

[`FragmentFinalizationMetadata`](FragmentFinalizationMetadata.md).[`fragments`](FragmentFinalizationMetadata.md#fragments)
