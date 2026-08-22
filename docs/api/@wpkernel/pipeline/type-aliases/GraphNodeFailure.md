[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphNodeFailure

# Type Alias: GraphNodeFailure&lt;TNodes, TEffects&gt;

```ts
type GraphNodeFailure&lt;TNodes, TEffects&gt; = { readonly [K in NodeKeyOf&lt;TNodes&gt;]: { error: FailureOf&lt;TNodes[K]&gt;; kind: "declared"; node: K; nodeOrdinal: number } | { error: unknown; kind: "thrown"; node: K; nodeOrdinal: number } | { error: GraphSchedulerError; kind: "contract"; node: K; nodeOrdinal: number } | { error: EffectJournalFailure&lt;TEffects&gt;; kind: "effect"; node: K; nodeOrdinal: number } }[NodeKeyOf&lt;TNodes&gt;];
```

A retained graph failure keyed to its exact declared node failure type.
The primary graph failure is selected by canonical node order, never by
settlement timing.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md) = [`EffectRegistry`](EffectRegistry.md)
