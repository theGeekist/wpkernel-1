[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / NodeTypes

# Type Alias: NodeTypes&lt;T&gt;

```ts
type NodeTypes&lt;T&gt; = T extends NodeContract&lt;infer TInput, infer TOutput, infer TFailure, infer TEffects&gt; ? object : never;
```

Extracts the four member-specific type families from a node contract.

## Type Parameters

### T

`T`
