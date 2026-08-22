[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / maybeAll

# Function: maybeAll()

```ts
function maybeAll&lt;TValues&gt;(values): MaybePromise&lt;AwaitedTuple&lt;TValues&gt;&gt;;
```

Resolves an ordered collection of values and thenables.

If every entry is synchronous, this returns a new array immediately. If any
entry is asynchronous, all captured thenables are adopted and the function
returns a native `Promise` with `Promise.all` ordering and rejection
semantics. Input order is preserved in both paths.

Each value crosses the same read-once boundary as [isPromiseLike](isPromiseLike.md).
A throwing getter remains a synchronous throw.

## Type Parameters

### TValues

`TValues` *extends* readonly `unknown`[]

## Parameters

### values

`TValues`

Ordered values to resolve.

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;[`AwaitedTuple`](../type-aliases/AwaitedTuple.md)&lt;`TValues`&gt;&gt;

A new array directly, or a native promise when any entry is asynchronous.

## Example

```ts
const immediate = maybeAll([1, 2, 3]);
isPromiseLike(immediate); // false

const deferred = maybeAll([1, Promise.resolve(2), 3]);
isPromiseLike(deferred); // true
```
