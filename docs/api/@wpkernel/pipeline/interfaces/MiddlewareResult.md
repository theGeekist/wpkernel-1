[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / MiddlewareResult

# Interface: MiddlewareResult&lt;TState, TRequest&gt;

Explicit run-local state and declared effect requests from a `before` phase.

## Type Parameters

### TState

`TState`

### TRequest

`TRequest`

## Properties

### effects

```ts
readonly effects: readonly TRequest[];
```

***

### state

```ts
readonly state: TState;
```
