[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / abandon

# Function: abandon()

```ts
function abandon&lt;TNodes, TOutputs, TEffects&gt;(options): AbandonResult&lt;TEffects&gt;;
```

Consumes one live suspension and compensates its journal exactly once.

Compensation is non-cancellable, runs in reverse logical journal order and
continues after failure. It is process-local remediation, not a durable
rollback guarantee.

## Type Parameters

### TNodes

`TNodes` *extends* `Readonly`&lt;`Record`&lt;`string`, [`NodeContract`](../interfaces/NodeContract.md)&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `string`&gt;&gt;&gt;

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TEffects

`TEffects` *extends* `Readonly`&lt;`Record`&lt;`string`, [`EffectContract`](../interfaces/EffectContract.md)&lt;[`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `unknown`, `unknown`&gt;&gt;&gt;

## Parameters

### options

[`AbandonOptions`](../interfaces/AbandonOptions.md)&lt;`TNodes`, `TOutputs`, `TEffects`&gt;

Live suspension to abandon.

## Returns

[`AbandonResult`](../type-aliases/AbandonResult.md)&lt;`TEffects`&gt;

An abandonment outcome retaining every cleanup failure.

## Throws

When the token is foreign, copied or spent.
