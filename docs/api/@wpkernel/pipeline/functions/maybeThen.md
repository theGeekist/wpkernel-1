[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / maybeThen

# Function: maybeThen()

```ts
function maybeThen<T, TResult>(value, onFulfilled): MaybePromise<TResult>;
```

Maps a synchronous value or safely inspectable thenable while preserving the
synchronous path.

For synchronous input, `onFulfilled` runs before this function returns and
its value is returned directly. Throws from that callback remain synchronous.
For a safely inspectable thenable, the captured method is adopted exactly
once into a native promise; callback throws then become promise rejections.
Accessor-backed or trap-hostile `then` properties remain ordinary data under
the boundary described by [isPromiseLike](isPromiseLike.md).

## Type Parameters

### T

`T`

### TResult

`TResult`

## Parameters

### value

[`MaybePromise`](../type-aliases/MaybePromise.md)<`T`>

Value or thenable to map.

### onFulfilled

(`value`) => [`MaybePromise`](../type-aliases/MaybePromise.md)<`TResult`>

Transformation applied to the fulfilled value.

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`TResult`>

The callback result directly for synchronous input, or a native chained promise for thenable input.

## Example

```ts
import { isPromiseLike, maybeThen } from '@wpkernel/pipeline';

const immediate = maybeThen(2, (value) => value * 3);
isPromiseLike(immediate); // false

const deferred = maybeThen(Promise.resolve(2), (value) => value * 3);
isPromiseLike(deferred); // true
```
