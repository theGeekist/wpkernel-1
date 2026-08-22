[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeOutcome

# Type Alias: NodeOutcome&lt;TNodes, TEffects&gt;

```ts
type NodeOutcome&lt;TNodes, TEffects&gt; = { readonly [K in NodeKeyOf&lt;TNodes&gt;]: { kind: "succeeded"; node: K; nodeOrdinal: number; output: OutputOf&lt;TNodes[K]&gt; } | { failure: Extract&lt;GraphNodeFailure&lt;TNodes, TEffects&gt;, { node: K }&gt;; kind: "failed"; node: K; nodeOrdinal: number } | { kind: "cancelled"; node: K; nodeOrdinal: number; reason?: unknown } | { blockedBy: readonly NodeKeyOf&lt;TNodes&gt;[]; kind: "blocked"; node: K; nodeOrdinal: number; reason: "dependency" | "admission-stopped" } }[NodeKeyOf&lt;TNodes&gt;];
```

Canonical terminal projection for one graph node.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md) = [`EffectRegistry`](EffectRegistry.md)
