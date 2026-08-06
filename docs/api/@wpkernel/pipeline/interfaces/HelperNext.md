[**@wpkernel/pipeline v1.2.1**](../README.md)

---

[@wpkernel/pipeline](../README.md) / HelperNext

# Interface: HelperNext()<TOutput>

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes downstream helpers with either the supplied
output or the current helper output. The returned value is the final output
produced by those helpers.

## Type Parameters

### TOutput

`TOutput`

## Call Signature

```ts
HelperNext(): MaybePromise<TOutput>;
```

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes downstream helpers with either the supplied
output or the current helper output. The returned value is the final output
produced by those helpers.

### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`TOutput`>

## Call Signature

```ts
HelperNext(output): MaybePromise<TOutput>;
```

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes downstream helpers with either the supplied
output or the current helper output. The returned value is the final output
produced by those helpers.

### Parameters

#### output

`TOutput`

### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)<`TOutput`>
