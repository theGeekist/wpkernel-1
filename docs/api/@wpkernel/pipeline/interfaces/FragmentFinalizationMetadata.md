[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / FragmentFinalizationMetadata

# Interface: FragmentFinalizationMetadata&lt;TFragmentKind&gt;

Execution metadata available when a standard pipeline finalises its draft.

The snapshot describes the configured fragment kind and the helpers that
were registered, executed, or excluded because dependencies were missing.

## Extended by

- [`PipelineExecutionMetadata`](PipelineExecutionMetadata.md)

## Type Parameters

### TFragmentKind

`TFragmentKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

## Properties

### fragments

```ts
readonly fragments: HelperExecutionSnapshot&lt;TFragmentKind&gt;;
```

Snapshot of fragment helper resolution and execution for this run.
