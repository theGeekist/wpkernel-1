[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / MiddlewareEnteredOptions

# Interface: MiddlewareEnteredOptions&lt;TKey, TInvocation, TState&gt;

Input for phases whose `before` phase completed, including its state.

## Extends

- [`MiddlewareInvocationOptions`](MiddlewareInvocationOptions.md)&lt;`TKey`, `TInvocation`&gt;

## Type Parameters

### TKey

`TKey`

### TInvocation

`TInvocation`

### TState

`TState`

## Properties

### invocation

```ts
readonly invocation: TInvocation;
```

#### Inherited from

[`MiddlewareInvocationOptions`](MiddlewareInvocationOptions.md).[`invocation`](MiddlewareInvocationOptions.md#invocation)

***

### node

```ts
readonly node: TKey;
```

#### Inherited from

[`MiddlewareInvocationOptions`](MiddlewareInvocationOptions.md).[`node`](MiddlewareInvocationOptions.md#node)

***

### state

```ts
readonly state: TState;
```
