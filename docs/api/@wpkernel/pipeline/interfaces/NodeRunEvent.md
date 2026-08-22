[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeRunEvent

# Interface: NodeRunEvent

Immutable diagnostic event emitted after one node state transition.

## Properties

### kind

```ts
readonly kind: "node-transition";
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

### sequence

```ts
readonly sequence: number;
```

***

### state

```ts
readonly state: "cancelled" | "succeeded" | "failed" | "active";
```
