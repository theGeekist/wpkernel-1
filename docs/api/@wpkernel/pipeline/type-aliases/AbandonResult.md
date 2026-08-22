[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / AbandonResult

# Type Alias: AbandonResult&lt;TEffects&gt;

```ts
type AbandonResult&lt;TEffects&gt; = MaybePromise&lt;AbandonmentOutcome&lt;TEffects&gt;&gt;;
```

Exact abandonment result, promoted only by asynchronous compensation or
terminal observer delivery.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
