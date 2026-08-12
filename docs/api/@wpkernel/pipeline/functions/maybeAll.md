[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / maybeAll

# Function: maybeAll()

```ts
function maybeAll<T>(values): MaybePromise<T[]>;
```

Resolves an ordered collection of values and safely inspectable thenables.

If every entry is synchronous, this returns a new array immediately. If any
entry is asynchronous, all captured thenables are adopted and the function
returns a native `Promise` with `Promise.all` ordering and rejection
semantics. Input order is preserved in both paths.

Each value crosses the same descriptor boundary as [isPromiseLike](isPromiseLike.md).
Accessor-backed or uninspectable `then` properties remain synchronous data.

## Type Parameters

### T

`T`

## Parameters

### values

readonly [`MaybePromise`](../type-aliases/MaybePromise.md)<`T`>[]

Ordered values to resolve.

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`T`[]>

A new array directly, or a native promise when any entry is asynchronous.

## Example

```ts
import { isPromiseLike, maybeAll } from '@wpkernel/pipeline';

const immediate = maybeAll([1, 2, 3]);
isPromiseLike(immediate); // false

const deferred = maybeAll([1, Promise.resolve(2), 3]);
isPromiseLike(deferred); // true
```
