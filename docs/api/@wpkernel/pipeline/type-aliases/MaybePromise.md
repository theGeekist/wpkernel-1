[**@wpkernel/pipeline v1.4.0**](../index.md)

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
synchronous. Runtime adoption recognises native promises and safely
inspectable data-property thenables. Accessor-backed or trap-hostile `then`
properties are deliberately treated as synchronous data.

## See

[HelperApplyFn](HelperApplyFn.md)
