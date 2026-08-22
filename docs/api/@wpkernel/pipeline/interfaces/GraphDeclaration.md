[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphDeclaration

# Interface: GraphDeclaration&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities&gt;

Immutable authoring data. Input keys declare shape only: admitted input
values are run-owned and are never embedded in this declaration or graph.

## Type Parameters

### TInputs

`TInputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TNodes

`TNodes` *extends* [`NodeRegistry`](../type-aliases/NodeRegistry.md)

### TEdges

`TEdges` *extends* readonly [`Edge`](Edge.md)[]

### TEffects

`TEffects` *extends* [`EffectRegistry`](../type-aliases/EffectRegistry.md)

### TProjection

`TProjection` *extends* [`OutputProjection`](../type-aliases/OutputProjection.md)&lt;`TNodes`&gt;

### TCapabilities

`TCapabilities`

## Properties

### edges

```ts
readonly edges: TEdges;
```

***

### effects

```ts
readonly effects: TEffects;
```

***

### executors

```ts
readonly executors: NodeExecutors&lt;TInputs, TNodes, TEdges, TEffects, TCapabilities&gt;;
```

***

### inputKeys

```ts
readonly inputKeys: readonly keyof TInputs & string[];
```

***

### nodes

```ts
readonly nodes: TNodes;
```

***

### outputs

```ts
readonly outputs: TProjection;
```

***

### policy

```ts
readonly policy: ExecutionPolicy;
```

***

### anchors?

```ts
readonly optional anchors: Readonly&lt;Record&lt;string, keyof TNodes & string&gt;&gt;;
```
