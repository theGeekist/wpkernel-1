[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineEdges

# Type Alias: PipelineEdges&lt;TEdges, TExtensions&gt;

```ts
type PipelineEdges&lt;TEdges, TExtensions&gt; = readonly Edge[];
```

Final edge tuple inferred from a creation-time extension tuple.

The emitted declaration retains tuple order and literal endpoints. The API
projection shows its public readonly [Edge](../interfaces/Edge.md) upper bound.

## Type Parameters

### TEdges

`TEdges` *extends* readonly [`Edge`](../interfaces/Edge.md)[]

### TExtensions

`TExtensions` *extends* readonly `object`[]
