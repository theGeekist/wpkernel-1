[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectContract

# Interface: EffectContract&lt;TPayload, TPrepared, TReceipt, TFailure&gt;

Static payload, prepared-state, receipt and failure types for one effect.

## Type Parameters

### TPayload

`TPayload` *extends* [`GraphValue`](../type-aliases/GraphValue.md)

### TPrepared

`TPrepared`

### TReceipt

`TReceipt`

### TFailure

`TFailure`

## Properties

### \[effectType\]()?

```ts
readonly optional [effectType]: () =&gt; object;
```

#### Returns

`object`

##### failure

```ts
readonly failure: TFailure;
```

##### payload

```ts
readonly payload: TPayload;
```

##### prepared

```ts
readonly prepared: TPrepared;
```

##### receipt

```ts
readonly receipt: TReceipt;
```
