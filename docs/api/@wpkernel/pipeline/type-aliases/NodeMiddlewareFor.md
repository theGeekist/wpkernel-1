[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeMiddlewareFor

# Type Alias: NodeMiddlewareFor&lt;TInputs, TNodes, TEdges, TEffects, TCapabilities, K, TState&gt;

```ts
type NodeMiddlewareFor&lt;TInputs, TNodes, TEdges, TEffects, TCapabilities, K, TState&gt; = NodeMiddleware&lt;K, NodeInvocation&lt;Readonly&lt;Pick&lt;TInputs, ExternalKeysOf&lt;TNodes[K]&gt; & keyof TInputs&gt;&gt;, DependencyOutputs&lt;TNodes, TEdges, K&gt;, TCapabilities&gt;, OutputOf&lt;TNodes[K]&gt;, TState, EffectRequestsFor&lt;TEffects, EffectKeysOf&lt;TNodes[K]&gt; & keyof TEffects&gt;&gt;;
```

Exact single-node middleware type derived from graph registries and edges.

## Type Parameters

### TInputs

`TInputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](GraphValue.md)&gt;&gt;

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TEdges

`TEdges` *extends* readonly [`Edge`](../interfaces/Edge.md)[]

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)

### TCapabilities

`TCapabilities`

### K

`K` *extends* keyof `TNodes` & [`NodeKey`](NodeKey.md)

### TState

`TState`
