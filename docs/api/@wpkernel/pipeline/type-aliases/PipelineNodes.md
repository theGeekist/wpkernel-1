[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineNodes

# Type Alias: PipelineNodes&lt;TNodes, TExtensions&gt;

```ts
type PipelineNodes&lt;TNodes, TExtensions&gt; = NodeRegistry;
```

Final node registry inferred from a creation-time extension tuple.

The emitted declaration retains every literal-keyed contribution. The API
projection shows its public [NodeRegistry](NodeRegistry.md) upper bound.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TExtensions

`TExtensions` *extends* readonly `object`[]
