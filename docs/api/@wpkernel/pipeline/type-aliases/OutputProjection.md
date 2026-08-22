[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / OutputProjection

# Type Alias: OutputProjection&lt;TNodes&gt;

```ts
type OutputProjection&lt;TNodes&gt; = Readonly&lt;Record&lt;string, keyof TNodes & NodeKey&gt;&gt;;
```

Named graph outputs mapped to existing node identities.

## Type Parameters

### TNodes

`TNodes` *extends* [`NodeRegistry`](NodeRegistry.md)
