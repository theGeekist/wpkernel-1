[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / RunPipelineOptions

# Interface: RunPipelineOptions&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities&gt;

Complete input for one fresh run over a configured [Pipeline](Pipeline.md) token.

Inputs are validated, copied and frozen. Capabilities are opaque process-local
services whose provider owns concurrency safety.

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

`TProjection` *extends* [`OutputProjection`](../type-aliases/OutputProjection.md)&lt;`TNodes`&gt;

### TCapabilities

`TCapabilities`

## Properties

### capabilities

```ts
readonly capabilities: NoInfer&lt;TCapabilities&gt;;
```

***

### inputs

```ts
readonly inputs: NoInfer&lt;TInputs&gt;;
```

***

### pipeline

```ts
readonly pipeline: Pipeline&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities&gt;;
```

***

### signal?

```ts
readonly optional signal: AbortSignal;
```
