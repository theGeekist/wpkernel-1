[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / GraphValue

# Type Alias: GraphValue

```ts
type GraphValue =
  | GraphScalar
  | readonly GraphValue[]
  | {
[key: string]: GraphValue;
};
```

The closed, acyclic value algebra admitted at graph ownership boundaries.

Graph values contain only scalar leaves, plain recursive arrays and plain
string-keyed records. At every ownership boundary Pipeline validates the
complete value, deep-copies it and recursively freezes the scheduler-owned
copy. Caller aliases are never retained as graph data.
