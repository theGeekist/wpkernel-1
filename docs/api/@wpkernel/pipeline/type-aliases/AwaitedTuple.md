[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / AwaitedTuple

# Type Alias: AwaitedTuple&lt;TValues&gt;

```ts
type AwaitedTuple&lt;TValues&gt; = { -readonly [K in keyof TValues]: Awaited&lt;TValues[K]&gt; };
```

Fresh mutable tuple of recursively awaited fulfilment values.

Literal positions and their distinct fulfilled value types are preserved;
readonly input positions become mutable because settlement creates a new
array and never returns the caller's tuple.

## Type Parameters

### TValues

`TValues` *extends* readonly `unknown`[]
