[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / HelperNext

# Interface: HelperNext()&lt;TOutput&gt;

Explicit continuation for wrapping the remainder of a helper chain.

Calling the continuation executes the remainder of a helper chain.

## Remarks

With no argument, downstream helpers receive the current output. Supplying an
argument replaces it. Repeated calls share the same downstream execution and
settlement while the owning helper participant remains unsettled. The
continuation is revoked when that participant settles; later calls fail
without executing downstream work. If a helper launches asynchronous
downstream work without awaiting it, the pipeline still waits for that work
before settling the helper or beginning rollback.

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

`MaybePromise`&lt;`TOutput`&gt;

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

`MaybePromise`&lt;`TOutput`&gt;
