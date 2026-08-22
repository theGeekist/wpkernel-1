[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / RunFailure

# Type Alias: RunFailure&lt;TNodes, TEffects&gt;

```ts
type RunFailure&lt;TNodes, TEffects&gt; =
  | GraphNodeFailure&lt;TNodes, TEffects&gt;
| EffectJournalFailure&lt;TEffects&gt;;
```

One failure retained by the complete graph and effect interpreter.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
