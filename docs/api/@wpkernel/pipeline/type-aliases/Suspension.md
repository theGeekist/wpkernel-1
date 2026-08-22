[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / Suspension

# Type Alias: Suspension&lt;TNodes, TOutputs, TEffects&gt;

```ts
type Suspension&lt;TNodes, TOutputs, TEffects&gt; = object;
```

Live, single-use process-local authority over one drained graph frontier.

The public pause and snapshot fields are diagnostic projections. Continuation
authority remains private, cannot be copied or serialised, and does not
survive process death. The host must retain and consume the original token.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)

### TOutputs

`TOutputs` *extends* `Readonly`&lt;`Record`&lt;`string`, [`GraphValue`](GraphValue.md)&gt;&gt;

### TEffects

`TEffects` *extends* [`EffectRegistry`](EffectRegistry.md)

## Properties

### pause

```ts
readonly pause: PauseRecord;
```

***

### snapshot

```ts
readonly snapshot: RunDiagnostics;
```
