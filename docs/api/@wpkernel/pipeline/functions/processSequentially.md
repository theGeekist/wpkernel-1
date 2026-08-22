[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / processSequentially

# Function: processSequentially()

```ts
function processSequentially&lt;T&gt;(
   items,
   handler,
direction): MaybePromise&lt;void&gt;;
```

Processes items in order without promoting an entirely synchronous traversal
to a promise.

Synchronous handlers run in the current call stack. After the first thenable
result, later items run only after that result settles. Each handler result
crosses the shared read-once thenable boundary. A synchronous throw or
throwing `then` getter stops traversal synchronously; after promotion, a
failure rejects the returned native promise and no later item is admitted.

## Type Parameters

### T

`T`

## Parameters

### items

readonly `T`[]

Ordered items to visit.

### handler

(`item`, `index`) =&gt; [`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`void`&gt;

Operation invoked once for each admitted item.

### direction

Whether to visit from the first item or the last.

`"forward"` | `"reverse"`

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`void`&gt;

`void` for a synchronous traversal, or a native promise after asynchronous promotion.

## Example

```ts
const visited: number[] = [];
const result = processSequentially([1, 2], (value) =&gt; {
  visited.push(value);
});
isPromiseLike(result); // false
```
