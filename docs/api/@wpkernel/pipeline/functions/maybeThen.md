[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / maybeThen

# Function: maybeThen()

```ts
function maybeThen&lt;T, TResult&gt;(value, onFulfilled): MaybePromise&lt;TResult&gt;;
```

Maps a synchronous value or structurally valid thenable while preserving the
synchronous path.

For synchronous input, `onFulfilled` runs before this function returns and
its value is returned directly. Throws from that callback remain synchronous.
For a thenable, the captured method is adopted exactly
once into a native promise; callback throws then become promise rejections.
A throwing `then` getter remains a synchronous throw.

## Type Parameters

### T

`T`

### TResult

`TResult`

## Parameters

### value

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`T`&gt;

Value or thenable to map.

### onFulfilled

(`value`) =&gt; [`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TResult`&gt;

Transformation applied to the fulfilled value.

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TResult`&gt;

The callback result directly for synchronous input, or a native chained promise for thenable input.

## Example

```ts
const immediate = maybeThen(2, (value) =&gt; value * 3);
isPromiseLike(immediate); // false

const deferred = maybeThen(Promise.resolve(2), (value) =&gt; value * 3);
isPromiseLike(deferred); // true
```
