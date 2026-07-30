[**@wpkernel/pipeline v1.2.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / HelperNext

# Interface: HelperNext()&lt;TOutput&gt;

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes downstream helpers with either the supplied
output or the current helper output. The returned value is the final output
produced by those helpers.

## Type Parameters

### TOutput

`TOutput`

## Call Signature

```ts
HelperNext(): MaybePromise&lt;TOutput&gt;;
```

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes downstream helpers with either the supplied
output or the current helper output. The returned value is the final output
produced by those helpers.

### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TOutput`&gt;

## Call Signature

```ts
HelperNext(output): MaybePromise&lt;TOutput&gt;;
```

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes downstream helpers with either the supplied
output or the current helper output. The returned value is the final output
produced by those helpers.

### Parameters

#### output

`TOutput`

### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TOutput`&gt;
