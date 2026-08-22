[**@wpkernel/pipeline v1.4.1**](../index.md)

***

[@wpkernel/pipeline](../index.md) / SuspensionError

# Type Alias: SuspensionError

```ts
type SuspensionError = Error & object;
```

Frozen tagged native error for a rejected suspension operation.
Resume and abandon throw this error when authority is absent or already spent.

## Type Declaration

### code

```ts
readonly code: "invalid-suspension" | "already-consumed";
```

### name

```ts
readonly name: "SuspensionError";
```
