[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphSchedulerError

# Type Alias: GraphSchedulerError

```ts
type GraphSchedulerError = Error & object;
```

Tagged scheduler-boundary or node-result contract failure.
Factories remain private to the evaluator; public outcomes expose this type
as retained evidence.

## Type Declaration

### code

```ts
readonly code:
  | "invalid-input"
  | "invalid-graph"
  | "invalid-node-result"
  | "invalid-middleware"
  | "invalid-observer"
  | "invalid-participant"
  | "invalid-effect-result";
```

### name

```ts
readonly name: "GraphSchedulerError";
```
