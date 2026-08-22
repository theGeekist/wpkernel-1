[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / ResumeOptions

# Interface: ResumeOptions&lt;TNodes, TOutputs, TEffects&gt;

Options for consuming a suspension by continuing its captured frontier.
A supplied signal becomes the sole signal for the resumed segment.

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

***

### signal?

```ts
readonly optional signal: AbortSignal;
```
