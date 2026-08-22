[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / DependencyOutputs

# Type Alias: DependencyOutputs&lt;TNodes, TEdges, K&gt;

```ts
type DependencyOutputs&lt;TNodes, TEdges, K&gt; = { readonly [P in Predecessors&lt;TEdges, K&gt; & keyof TNodes]: OutputOf&lt;TNodes[P]&gt; };
```

Direct predecessor outputs keyed by their node identities.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TEdges

`TEdges` *extends* readonly [`Edge`](../interfaces/Edge.md)[]

### K

`K` *extends* keyof `TNodes` & [`NodeKey`](NodeKey.md)
