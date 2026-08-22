[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / runPipeline

# Function: runPipeline()

```ts
function runPipeline&lt;TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities&gt;(options): RunPipelineResult&lt;TNodes, TEffects, TProjection&gt;;
```

Compiles and evaluates one fresh run through the sole public lifecycle operation.

Every configuration issue is collected before executable role compilers run.
On success, ready nodes are admitted by canonical graph order; timing does
not choose outputs, the primary failure or effect commit order. The return is
synchronous unless a participating return exposes a callable `then`.

Pipeline owns only this process-local evaluation. Durable admission, leases,
crash recovery, portable checkpoints and exactly-once external effects are
host responsibilities.

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

## Parameters

### options

[`RunPipelineOptions`](../interfaces/RunPipelineOptions.md)&lt;`TInputs`, `TNodes`, `TEdges`, `TEffects`, `TProjection`, `TCapabilities`&gt;

Pipeline token and run-local admission values.

## Returns

[`RunPipelineResult`](../type-aliases/RunPipelineResult.md)&lt;`TNodes`, `TEffects`, `TProjection`&gt;

Configuration evidence, admission evidence or a terminal run outcome.
