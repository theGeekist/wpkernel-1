[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectTypes

# Type Alias: EffectTypes&lt;T&gt;

```ts
type EffectTypes&lt;T&gt; = T extends EffectContract&lt;infer TPayload, infer TPrepared, infer TReceipt, infer TFailure&gt; ? object : never;
```

Extracts the four member-specific type families from an effect contract.

## Type Parameters

### T

`T`
