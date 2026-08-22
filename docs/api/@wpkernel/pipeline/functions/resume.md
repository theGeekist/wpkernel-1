[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / resume

# Function: resume()

```ts
function resume&lt;TNodes, TOutputs, TEffects&gt;(options): ResumeResult&lt;TNodes, TOutputs, TEffects&gt;;
```

Consumes and continues one live process-local suspension exactly once.

Claiming happens before continuation, so a failed resume still spends the
capability. Historical observer promises do not permanently promote this
call; only work participating in the resumed segment can do so.

## Type Parameters

### TNodes

`TNodes` *extends* `Readonly`&lt;`Record`&lt;`string`, [`NodeContract`](../interfaces/NodeContract.md)&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `string`&gt;&gt;&gt;

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TEffects

`TEffects` *extends* `Readonly`&lt;`Record`&lt;`string`, [`EffectContract`](../interfaces/EffectContract.md)&lt;[`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `unknown`, `unknown`&gt;&gt;&gt;

## Parameters

### options

[`ResumeOptions`](../interfaces/ResumeOptions.md)&lt;`TNodes`, `TOutputs`, `TEffects`&gt;

Live suspension and optional replacement signal.

## Returns

[`ResumeResult`](../type-aliases/ResumeResult.md)&lt;`TNodes`, `TOutputs`, `TEffects`&gt;

The terminal outcome, or a new suspension if this segment pauses.

## Throws

When the token is foreign, copied or spent.
