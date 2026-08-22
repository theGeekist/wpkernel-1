[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / MaybePromise

# Type Alias: MaybePromise&lt;T&gt;

```ts
type MaybePromise&lt;T&gt; = T | PromiseLike&lt;T&gt;;
```

A value that may be available synchronously or through a promise-compatible
thenable.

## Type Parameters

### T

`T`

Settled value type.

## Remarks

Pipeline operations preserve the synchronous path when every participant is
synchronous. Runtime adoption reads `then` exactly once. A callable value,
including one returned by a getter, is adopted with first-settlement
semantics; a throwing getter is a synchronous participant failure.

## See

 - [maybeThen](../functions/maybeThen.md)
 - [maybeAll](../functions/maybeAll.md)
