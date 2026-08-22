[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / AbandonOptions

# Interface: AbandonOptions&lt;TNodes, TOutputs, TEffects&gt;

Options for consuming a suspension by compensating its prepared journal.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](../type-aliases/NodeRegistry.md)

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TEffects

`TEffects` *extends* [`EffectRegistry`](../type-aliases/EffectRegistry.md)

## Properties

### suspension

```ts
readonly suspension: Suspension&lt;TNodes, TOutputs, TEffects&gt;;
```
