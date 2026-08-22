[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / TerminalRunEvent

# Interface: TerminalRunEvent

Immutable terminal diagnostic event queued after run finalisation.

## Properties

### kind

```ts
readonly kind: "run-terminal";
```

***

### outcomeKind

```ts
readonly outcomeKind: "cancelled" | "succeeded" | "failed" | "suspended" | "abandoned";
```

***

### sequence

```ts
readonly sequence: number;
```
