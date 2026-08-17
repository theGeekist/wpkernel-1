[**@wpkernel/test-utils v0.12.6-beta.3**](../index.md)

---

[@wpkernel/test-utils](../index.md) / resolveLayoutRelativeSpecifier

# Function: resolveLayoutRelativeSpecifier()

```ts
function resolveLayoutRelativeSpecifier(fromId, toId, filename?): string;
```

Computes a module specifier between two layout ids, optionally appending a filename,
relative to a provided `fromPath` (or the inferred `fromId` path when omitted).

## Parameters

### fromId

`string`

### toId

`string`

### filename?

`string`

## Returns

`string`
