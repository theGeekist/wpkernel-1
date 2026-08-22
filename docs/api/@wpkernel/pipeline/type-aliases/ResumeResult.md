[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / ResumeResult

# Type Alias: ResumeResult&lt;TNodes, TOutputs, TEffects&gt;

```ts
type ResumeResult&lt;TNodes, TOutputs, TEffects&gt; = MaybePromise&lt;RunOutcome&lt;TNodes, TOutputs, TEffects&gt;&gt;;
```

Exact continuation result, promoted only by asynchronous resumed work or
terminal observer delivery.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](GraphValue.md)&gt;&gt;

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
