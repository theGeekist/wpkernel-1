[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineProjection

# Type Alias: PipelineProjection&lt;TNodes, TProjection, TExtensions&gt;

```ts
type PipelineProjection&lt;TNodes, TProjection, TExtensions&gt; = OutputProjection&lt;PipelineNodes&lt;TNodes, TExtensions&gt;&gt;;
```

Final output projection inferred from a creation-time extension tuple.

The emitted declaration retains exact named projection keys. The API
projection shows the corresponding public [OutputProjection](OutputProjection.md) bound.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TProjection

`TProjection`

### TExtensions

`TExtensions` *extends* readonly `object`[]
