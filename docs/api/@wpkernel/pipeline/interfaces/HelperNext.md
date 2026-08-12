[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / HelperNext

# Interface: HelperNext()&lt;TOutput&gt;

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes the remainder of a helper chain.

## Remarks

With no argument, downstream helpers receive the current output. Supplying an
argument replaces it. Repeated calls share the same downstream execution and
settlement. If a helper launches asynchronous downstream work without
awaiting it, the pipeline still waits for that work before settling the
helper or beginning rollback.

## Type Parameters

### TOutput

`TOutput`

Value threaded through the helper chain.

## Call Signature

```ts
HelperNext(): MaybePromise&lt;TOutput&gt;;
```

Continues with the current output.

### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TOutput`&gt;

## Call Signature

```ts
HelperNext(output): MaybePromise&lt;TOutput&gt;;
```

Continues with an explicit replacement output.

### Parameters

#### output

`TOutput`

Value supplied to the next helper in the chain.

### Returns

[`MaybePromise`](../type-aliases/MaybePromise.md)&lt;`TOutput`&gt;
