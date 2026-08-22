[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / EffectRunEvent

# Interface: EffectRunEvent

Immutable diagnostic event emitted after one effect phase transition.

## Properties

### effectOrdinal

```ts
readonly effectOrdinal: number;
```

***

### kind

```ts
readonly kind: "effect-transition";
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

### participant

```ts
readonly participant: string;
```

***

### phase

```ts
readonly phase: EffectPhase;
```

***

### sequence

```ts
readonly sequence: number;
```

***

### state

```ts
readonly state: "succeeded" | "failed";
```
