[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectJournalEntry

# Interface: EffectJournalEntry&lt;TEffects&gt;

Immutable diagnostic projection of one successfully prepared journal entry.
It carries evidence, not authority to settle or replay the effect.

## Type Parameters

### TEffects

`TEffects` *extends* [`EffectRegistry`](../type-aliases/EffectRegistry.md)

## Properties

### commit

```ts
readonly commit: "not-attempted" | "succeeded" | "failed";
```

***

### compensation

```ts
readonly compensation: "not-attempted" | "succeeded" | "failed";
```

***

### effectOrdinal

```ts
readonly effectOrdinal: number;
```

***

### node

```ts
readonly node: string;
```

***

### nodeOrdinal

```ts
readonly nodeOrdinal: number;
```

***

### request

```ts
readonly request: EffectRequest&lt;TEffects&gt;;
```
