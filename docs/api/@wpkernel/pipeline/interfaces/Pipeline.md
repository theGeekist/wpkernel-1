[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / Pipeline

# Interface: Pipeline&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities&gt;

Immutable nominal authority for one configured process-local evaluator.

Pipeline is deliberately data, not a method facade. Only [runPipeline](../functions/runPipeline.md)
can start a fresh run, and the token is meaningful only in the process that
created it. It is not a durable plan or a portable checkpoint.

## Type Parameters

### TInputs

`TInputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TNodes

`TNodes` *extends* [`NodeRegistry`](../type-aliases/NodeRegistry.md)

### TEdges

`TEdges` *extends* readonly [`Edge`](Edge.md)[]

### TEffects

`TEffects` *extends* [`EffectRegistry`](../type-aliases/EffectRegistry.md)

### TProjection

`TProjection`

### TCapabilities

`TCapabilities`

## Properties

### kind

```ts
readonly kind: "pipeline";
```
