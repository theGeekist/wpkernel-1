[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectRequestsFor

# Type Alias: EffectRequestsFor&lt;TEffects, K&gt;

```ts
type EffectRequestsFor&lt;TEffects, K&gt; = { readonly [P in K]: EffectRequestFor&lt;TEffects, P&gt; }[K];
```

Union of requests admitted for a node's declared participant keys.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)

### K

`K` *extends* keyof `TEffects`
