[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / isPromiseLike

# Function: isPromiseLike()

## Call Signature

```ts
function isPromiseLike&lt;T&gt;(value): value is PromiseLike&lt;T&gt;;
```

Tests whether a value exposes a callable `then` through one ordinary
property read. Accessors and proxy traps therefore follow JavaScript's normal
semantics and may throw synchronously.

### Type Parameters

#### T

`T`

### Parameters

#### value

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`T`&gt;

Candidate synchronous value or thenable.

### Returns

`value is PromiseLike&lt;T&gt;`

`true` only when that read observes a callable `then`.

### Example

```ts
isPromiseLike(Promise.resolve('ready')); // true
isPromiseLike('ready'); // false
```

## Call Signature

```ts
function isPromiseLike(value): value is PromiseLike&lt;unknown&gt;;
```

Tests whether a value exposes a callable `then` through one ordinary
property read. Accessors and proxy traps therefore follow JavaScript's normal
semantics and may throw synchronously.

### Parameters

#### value

`unknown`

Candidate synchronous value or thenable.

### Returns

`value is PromiseLike&lt;unknown&gt;`

`true` only when that read observes a callable `then`.

### Example

```ts
isPromiseLike(Promise.resolve('ready')); // true
isPromiseLike('ready'); // false
```
