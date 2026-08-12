[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / maybeTry

# Function: maybeTry()

```ts
function maybeTry<T>(run, onError): MaybePromise<T>;
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

() => [`MaybePromise`](../type-aliases/MaybePromise.md)<`T`>

Operation to execute.

### onError

(`error`) => [`MaybePromise`](../type-aliases/MaybePromise.md)<`T`>

Recovery invoked with the original failure.

## Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`T`>

The successful result or recovery result, preserving sync when possible.

## Example

```ts
import { maybeTry } from '@wpkernel/pipeline';

const parsed = maybeTry(
	() => JSON.parse('{invalid}') as unknown,
	() => ({ valid: false })
);
```
