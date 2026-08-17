[**@wpkernel/core v0.12.6-beta.3**](../index.md)

---

[@wpkernel/core](../index.md) / ParamsOf

# Type Alias: ParamsOf&lt;K, Key&gt;

```ts
type ParamsOf&lt;K, Key&gt; = K[Key] extends void ? [] : [K[Key]];
```

Extract the tuple type used for params in `can`/`assert` helpers.
Ensures that void params are optional while others remain required.

## Type Parameters

### K

`K`

### Key

`Key` _extends_ keyof `K`
