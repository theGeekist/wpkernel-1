[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectParticipant

# Interface: EffectParticipant&lt;TContract&gt;

Process-local interpreter for one declared effect contract.

Requests prepare during node evaluation. After graph success, commits run in
canonical node and effect order. Failure compensates in reverse journal
chronology. This is disciplined process-local work, not a transaction or an
exactly-once external-effect claim.

Each phase preserves synchronous settlement until its own return exposes a
callable `then`.

## Type Parameters

### TContract

`TContract` *extends* [`EffectContract`](EffectContract.md)&lt;[`GraphValue`](../type-aliases/GraphValue.md), `unknown`, `unknown`, `unknown`&gt;

## Properties

### commit()

```ts
readonly commit: (options) =&gt; MaybePromise&lt;EffectPhaseResult&lt;EffectTypes&lt;TContract&gt;["receipt"], EffectTypes&lt;TContract&gt;["failure"]&gt;&gt;;
```

#### Parameters

##### options

###### prepared

[`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"prepared"`\]

###### signal

`AbortSignal`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;[`EffectPhaseResult`](../type-aliases/EffectPhaseResult.md)&lt;[`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"receipt"`\], [`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"failure"`\]&gt;&gt;

***

### compensate()

```ts
readonly compensate: (options) =&gt; MaybePromise&lt;EffectPhaseResult&lt;void, EffectTypes&lt;TContract&gt;["failure"]&gt;&gt;;
```

#### Parameters

##### options

###### prepared

[`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"prepared"`\]

###### receipt?

[`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"receipt"`\]

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;[`EffectPhaseResult`](../type-aliases/EffectPhaseResult.md)&lt;`void`, [`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"failure"`\]&gt;&gt;

***

### prepare()

```ts
readonly prepare: (options) =&gt; MaybePromise&lt;EffectPhaseResult&lt;EffectTypes&lt;TContract&gt;["prepared"], EffectTypes&lt;TContract&gt;["failure"]&gt;&gt;;
```

#### Parameters

##### options

###### payload

[`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"payload"`\]

###### signal

`AbortSignal`

#### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;[`EffectPhaseResult`](../type-aliases/EffectPhaseResult.md)&lt;[`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"prepared"`\], [`EffectTypes`](../type-aliases/EffectTypes.md)&lt;`TContract`&gt;\[`"failure"`\]&gt;&gt;
