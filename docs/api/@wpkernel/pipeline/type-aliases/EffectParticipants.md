[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectParticipants

# Type Alias: EffectParticipants&lt;TEffects&gt;

```ts
type EffectParticipants&lt;TEffects&gt; = keyof TEffects extends never ? EmptyEffectParticipants : { readonly [K in keyof TEffects]: EffectParticipant&lt;TEffects[K]&gt; };
```

Exact literal-keyed participant table required by a graph's effect contracts.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
