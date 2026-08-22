[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeExecutors

# Type Alias: NodeExecutors&lt;TInputs, TNodes, TEdges, TEffects, TCapabilities&gt;

```ts
type NodeExecutors&lt;TInputs, TNodes, TEdges, TEffects, TCapabilities&gt; = { readonly [K in keyof TNodes & NodeKey]: (options: NodeInvocation&lt;Readonly&lt;Pick&lt;TInputs, ExternalKeysOf&lt;TNodes[K]&gt; & keyof TInputs&gt;&gt;, DependencyOutputs&lt;TNodes, TEdges, K&gt;, TCapabilities&gt;) =&gt; MaybePromise&lt;NodeResult&lt;OutputOf&lt;TNodes[K]&gt;, FailureOf&lt;TNodes[K]&gt;, EffectRequestsFor&lt;TEffects, EffectKeysOf&lt;TNodes[K]&gt; & keyof TEffects&gt;&gt;&gt; };
```

Exact literal-keyed executor table derived from nodes, edges and effects.

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
