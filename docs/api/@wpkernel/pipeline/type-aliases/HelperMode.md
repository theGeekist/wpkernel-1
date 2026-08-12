[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / HelperMode

# Type Alias: HelperMode

```ts
type HelperMode = "extend" | "override";
```

Registration policy for helpers that share a key.

## Remarks

`extend` keeps all registrations. `override` removes earlier registrations
for the same key. Registering a second override for that key is a fatal
configuration conflict.
