[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphOutputs

# Type Alias: GraphOutputs&lt;TNodes, TProjection&gt;

```ts
type GraphOutputs&lt;TNodes, TProjection&gt; = { readonly [K in keyof TProjection]: OutputOf&lt;TNodes[TProjection[K]]&gt; };
```

Resolves a projection to its exact named output value types.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TProjection

`TProjection` *extends* [`OutputProjection`](OutputProjection.md)&lt;`TNodes`&gt;
