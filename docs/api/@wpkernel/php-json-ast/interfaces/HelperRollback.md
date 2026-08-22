[**@wpkernel/php-json-ast v0.12.6-beta.3**](../index.md)

***

[@wpkernel/php-json-ast](../index.md) / HelperRollback

# Interface: HelperRollback&lt;TResult&gt;

Type-only v1 descriptor for cleanup admitted after a helper succeeds.

Returning this descriptor from [HelperApplyResult.rollback](HelperApplyResult.md#rollback) requests
best-effort cleanup if later serial work fails. The callback remains
consumer-authored and callable by its owner. The descriptor grants no
evaluator admission or traversal authority; the compatibility evaluator
exclusively owns admission and reverse-order invocation.

## Type Parameters

### TResult

`TResult` = `unknown`

Direct or recursively adopted cleanup result.

## Properties

### run()

```ts
readonly run: () =&gt; MaybePromise&lt;TResult&gt;;
```

Cleanup invoked at most once by one evaluator-owned traversal.

The result crosses the standard read-once thenable boundary: a direct
value keeps cleanup synchronous, while a callable `then` is adopted before
the evaluator continues to the next older cleanup.

#### Returns

`MaybePromise`&lt;`TResult`&gt;

***

### key?

```ts
readonly optional key: string;
```

Stable machine-readable helper key for diagnostics.

***

### label?

```ts
readonly optional label: string;
```

Human-readable cleanup description for observers.
