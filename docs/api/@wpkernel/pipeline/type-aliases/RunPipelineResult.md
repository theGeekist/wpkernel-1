[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / RunPipelineResult

# Type Alias: RunPipelineResult&lt;TNodes, TEffects, TProjection&gt;

```ts
type RunPipelineResult&lt;TNodes, TEffects, TProjection&gt; = MaybePromise&lt;
  | PipelineAdmissionFailure
  | PipelineConfigurationFailure
| RunOutcome&lt;TNodes, GraphOutputs&lt;TNodes, TProjection&gt;, TEffects&gt;&gt;;
```

Exact algebraic result of configuration, compilation and evaluation.

The result stays synchronous until a participant return exposes a callable
`then`; that return is then adopted through normal promise resolution.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)

### TProjection

`TProjection` *extends* [`OutputProjection`](OutputProjection.md)&lt;`TNodes`&gt;
