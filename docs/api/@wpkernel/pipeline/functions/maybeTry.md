[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / maybeTry

# Function: maybeTry()

```ts
function maybeTry&lt;T&gt;(run, onError): MaybePromise&lt;T&gt;;
```

Runs an operation and recovers from either a synchronous throw or a rejected
safely inspectable thenable.

A successful synchronous result is returned directly. A synchronous throw
calls `onError` immediately, so a synchronous recovery also remains
synchronous. Once `run` returns a thenable, the outcome is a native promise
and recovery runs through its rejection channel. The recovery function may
itself return a value or thenable.

Values excluded by the hardened boundary in [isPromiseLike](isPromiseLike.md) are
successful synchronous data, even when they expose an accessor named `then`.

## Type Parameters

### T

`T`

## Parameters

### run

() =&gt; [`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`T`&gt;

Operation to execute.

### onError

(`error`) =&gt; [`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`T`&gt;

Recovery invoked with the original failure.

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`T`&gt;

The successful result or recovery result, preserving sync when possible.

## Example

```ts
import { maybeTry } from '@wpkernel/pipeline';

const parsed = maybeTry(
  () =&gt; JSON.parse('{invalid}') as unknown,
  () =&gt; ({ valid: false })
);
```
