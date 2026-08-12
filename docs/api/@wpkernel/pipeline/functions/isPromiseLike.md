[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / isPromiseLike

# Function: isPromiseLike()

## Call Signature

```ts
function isPromiseLike<T>(value): value is PromiseLike<T>;
```

Tests whether a value exposes an inspectable data-property `then` method.

This is the same hardened boundary used by [maybeThen](maybeThen.md),
[maybeTry](maybeTry.md) and [maybeAll](maybeAll.md). It walks own and prototype property
descriptors without evaluating a `then` accessor or reading `value.then`.
Proxy descriptor and prototype traps may run as part of inspection; if they
throw, the exception is contained and the value is treated as synchronous
data. An accessor-backed `then` is also treated as data rather than invoked.

This intentionally differs from ordinary JavaScript promise assimilation,
which reads `value.then` and may execute user code. The guard is suitable at
native or hostile-object boundaries where inspecting an accessor would grant
ambient execution.

### Type Parameters

#### T

`T`

### Parameters

#### value

[`MaybePromise`](../type-aliases/MaybePromise.md)<`T`>

Candidate synchronous value or thenable.

### Returns

`value is PromiseLike<T>`

`true` only for a safely captured data-property `then` function.

### Example

```ts
import { isPromiseLike } from '@wpkernel/pipeline';

const accessorBacked = Object.defineProperty({}, 'then', {
	get() {
		throw new Error('must not execute');
	},
});

isPromiseLike(Promise.resolve('ready')); // true
isPromiseLike(accessorBacked); // false, getter was not evaluated
```

## Call Signature

```ts
function isPromiseLike(value): value is PromiseLike<unknown>;
```

Tests whether a value exposes an inspectable data-property `then` method.

This is the same hardened boundary used by [maybeThen](maybeThen.md),
[maybeTry](maybeTry.md) and [maybeAll](maybeAll.md). It walks own and prototype property
descriptors without evaluating a `then` accessor or reading `value.then`.
Proxy descriptor and prototype traps may run as part of inspection; if they
throw, the exception is contained and the value is treated as synchronous
data. An accessor-backed `then` is also treated as data rather than invoked.

This intentionally differs from ordinary JavaScript promise assimilation,
which reads `value.then` and may execute user code. The guard is suitable at
native or hostile-object boundaries where inspecting an accessor would grant
ambient execution.

### Parameters

#### value

`unknown`

Candidate synchronous value or thenable.

### Returns

`value is PromiseLike<unknown>`

`true` only for a safely captured data-property `then` function.

### Example

```ts
import { isPromiseLike } from '@wpkernel/pipeline';

const accessorBacked = Object.defineProperty({}, 'then', {
	get() {
		throw new Error('must not execute');
	},
});

isPromiseLike(Promise.resolve('ready')); // true
isPromiseLike(accessorBacked); // false, getter was not evaluated
```
