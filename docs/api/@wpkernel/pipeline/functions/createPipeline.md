[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / createPipeline

# Function: createPipeline()

```ts
function createPipeline&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities, TParticipants, TExtensions, TMiddleware&gt;(options): Pipeline&lt;TInputs, PipelineNodes&lt;TNodes, TExtensions&gt;, PipelineEdges&lt;TEdges, TExtensions&gt;, TEffects, PipelineProjection&lt;TNodes, TProjection, TExtensions&gt;, TCapabilities&gt;;
```

Creates one immutable configured evaluator without a method facade.

Extension callbacks are captured before any is invoked. Their configuration
is owned first, and each callback runs exactly once in tuple order. Creating
a different configuration means creating a different Pipeline token.

Creation owns and freezes the graph declaration, captures registrations and
invokes each extension contribution. It performs no graph compilation or
execution and claims no durable or cross-process authority.

## Type Parameters

### TInputs

`TInputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md)&gt;&gt;

### TNodes

`TNodes` *extends* `Readonly`&lt;`Record`&lt;`string`, [`NodeContract`](../interfaces/NodeContract.md)&lt;`string`, [`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `string`&gt;&gt;&gt;

### TEdges

`TEdges` *extends* readonly [`Edge`](../interfaces/Edge.md)&lt;`string`, `string`&gt;[]

### TEffects

`TEffects` *extends* `Readonly`&lt;`Record`&lt;`string`, [`EffectContract`](../interfaces/EffectContract.md)&lt;[`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `unknown`, `unknown`&gt;&gt;&gt;

### TProjection

`TProjection` *extends* `Readonly`&lt;`Record`&lt;`string`, keyof `TNodes` & `string`&gt;&gt;

### TCapabilities

`TCapabilities`

### TParticipants

`TParticipants` *extends* `Readonly`&lt;`Record`&lt;`PropertyKey`, `unknown`&gt;&gt;

### TExtensions

`TExtensions` *extends* readonly `object`[] = readonly \[\]

### TMiddleware

`TMiddleware` *extends* readonly [`NodeMiddleware`](../interfaces/NodeMiddleware.md)&lt;`string`, `never`, `unknown`, `unknown`, `unknown`&gt;[] = readonly \[\]

## Parameters

### options

[`CreatePipelineOptions`](../interfaces/CreatePipelineOptions.md)&lt;`TInputs`, `TNodes`, `TEdges`, `TEffects`, `TProjection`, `TCapabilities`, `TExtensions`, `TParticipants`, `TMiddleware`&gt;

Complete evaluator configuration to capture.

## Returns

[`Pipeline`](../interfaces/Pipeline.md)&lt;`TInputs`, [`PipelineNodes`](../type-aliases/PipelineNodes.md)&lt;`TNodes`, `TExtensions`&gt;, [`PipelineEdges`](../type-aliases/PipelineEdges.md)&lt;`TEdges`, `TExtensions`&gt;, `TEffects`, [`PipelineProjection`](../type-aliases/PipelineProjection.md)&lt;`TNodes`, `TProjection`, `TExtensions`&gt;, `TCapabilities`&gt;

A frozen process-local Pipeline token.
