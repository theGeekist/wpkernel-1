[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / adoptMaybePromise

# Function: adoptMaybePromise()

```ts
function adoptMaybePromise&lt;T&gt;(value):
  | {
  promise: Promise&lt;T&gt;;
  value?: undefined;
}
  | {
  promise: null;
  value: T;
};
```

Adopt a promise-like value using the exact `then` method observed through
one ordinary property read. The returned record carries `promise: null` for
synchronous values. A throwing `then` getter remains a synchronous throw for
the caller to compose through [maybeTry](maybeTry.md) when recovery is required.

## Type Parameters

### T

`T`

## Parameters

### value

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`T`&gt;

A value that may or may not be promise-like

## Returns

  \| \{
  `promise`: `Promise`&lt;`T`&gt;;
  `value?`: `undefined`;
\}
  \| \{
  `promise`: `null`;
  `value`: `T`;
\}

A tagged record containing either the direct value or its adopted native promise.
