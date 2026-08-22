[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / Predecessors

# Type Alias: Predecessors&lt;TEdges, K&gt;

```ts
type Predecessors&lt;TEdges, K&gt; = Extract&lt;TEdges[number], {
  to: K;
}&gt;["from"];
```

Source keys of edges whose target is `K`.

## Type Parameters

### TEdges

`TEdges` *extends* readonly [`Edge`](../interfaces/Edge.md)[]

### K

`K` *extends* [`NodeKey`](NodeKey.md)
