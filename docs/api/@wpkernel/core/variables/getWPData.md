[**@wpkernel/core v0.12.6-beta.3**](../index.md)

---

[@wpkernel/core](../index.md) / getWPData

# Variable: getWPData()

```ts
const getWPData: () =&gt; __module | undefined = globalThis.getWPData;
```

Safe accessor that works in browser & SSR contexts
Available globally without imports

## Returns

`__module` \| `undefined`

WordPress data package or undefined if not available
