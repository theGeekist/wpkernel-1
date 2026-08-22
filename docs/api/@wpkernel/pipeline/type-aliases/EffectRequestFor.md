[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectRequestFor

# Type Alias: EffectRequestFor&lt;TEffects, K&gt;

```ts
type EffectRequestFor&lt;TEffects, K&gt; = object;
```

One payload request for the literal participant `K`.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)

### K

`K` *extends* keyof `TEffects`

## Properties

### participant

```ts
readonly participant: K;
```

***

### payload

```ts
readonly payload: EffectTypes&lt;TEffects[K]&gt;["payload"];
```
