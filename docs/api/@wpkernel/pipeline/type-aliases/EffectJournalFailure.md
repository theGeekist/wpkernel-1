[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectJournalFailure

# Type Alias: EffectJournalFailure&lt;TEffects&gt;

```ts
type EffectJournalFailure&lt;TEffects&gt; = { readonly [K in keyof TEffects & string]: EffectFailureFor&lt;TEffects, K&gt; }[keyof TEffects & string];
```

Typed, immutable record of a contained participant failure.
Original declared, thrown or rejected errors remain attached to their exact
participant and logical journal position.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)
