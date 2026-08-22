[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectRequest

# Type Alias: EffectRequest&lt;TEffects&gt;

```ts
type EffectRequest&lt;TEffects&gt; = { readonly [K in keyof TEffects]: EffectRequestFor&lt;TEffects, K&gt; }[keyof TEffects];
```

Immutable effect request union for one literal participant registry.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
