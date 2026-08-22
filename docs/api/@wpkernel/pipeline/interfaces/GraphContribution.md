[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphContribution

# Interface: GraphContribution&lt;TNodes, TEdges, TOutputs&gt;

Immutable graph authoring fragment returned by one extension callback.
Anchors are inert references; they carry no scheduling authority.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](../type-aliases/NodeRegistry.md) = [`NodeRegistry`](../type-aliases/NodeRegistry.md)

### TEdges

`TEdges` *extends* readonly [`Edge`](Edge.md)[] = readonly [`Edge`](Edge.md)[]

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`NodeKey`](../type-aliases/NodeKey.md)&gt;&gt; = `Readonly`&lt;`Record`&lt;`string`, [`NodeKey`](../type-aliases/NodeKey.md)&gt;&gt;

## Properties

### executors

```ts
readonly executors: Readonly&lt;Record&lt;keyof TNodes & NodeKey, unknown&gt;&gt;;
```

***

### anchors?

```ts
readonly optional anchors: Readonly&lt;Record&lt;string, string&gt;&gt;;
```

***

### edges?

```ts
readonly optional edges: TEdges;
```

***

### nodes?

```ts
readonly optional nodes: TNodes;
```

***

### outputs?

```ts
readonly optional outputs: TOutputs;
```
