[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / HelperExecutionSnapshot

# Interface: HelperExecutionSnapshot<TKind>

Summary of registration and execution for one helper kind.

## Remarks

Standard pipeline finalisation exposes this metadata so consumers can reason
about conditional stage composition without receiving executable helpers.

## Type Parameters

### TKind

`TKind` _extends_ [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Helper kind represented by this summary.

## Properties

### executed

```ts
readonly executed: readonly string[];
```

Registration identities that completed execution.

---

### kind

```ts
readonly kind: TKind;
```

Helper kind described by this snapshot.

---

### missing

```ts
readonly missing: readonly string[];
```

Registered identities that did not execute.

---

### registered

```ts
readonly registered: readonly string[];
```

Registration identities captured when the run began.
