[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeDiagnostic

# Interface: NodeDiagnostic

Canonical diagnostic record for one node at a segment boundary.
The record is inspection data and carries no scheduler authority.

## Properties

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

### state

```ts
readonly state: "cancelled" | "succeeded" | "failed" | "pending";
```

***

### admissionSequence?

```ts
readonly optional admissionSequence: number;
```

***

### blockedBy?

```ts
readonly optional blockedBy: readonly string[];
```

***

### readiness?

```ts
readonly optional readiness: "ready" | "blocked";
```

***

### settlementSequence?

```ts
readonly optional settlementSequence: number;
```
