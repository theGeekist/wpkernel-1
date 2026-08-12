[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / ConflictDiagnostic

# Interface: ConflictDiagnostic&lt;TKind&gt;

Fatal diagnostic emitted when two override helpers claim the same key.

## Type Parameters

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Helper-kind union associated with the diagnostic.

## Properties

### helpers

```ts
readonly helpers: readonly string[];
```

Origins or keys of the competing registrations.

***

### key

```ts
readonly key: string;
```

Conflicting helper key.

***

### message

```ts
readonly message: string;
```

Human-readable description.

***

### mode

```ts
readonly mode: HelperMode;
```

Registration mode that caused the conflict.

***

### type

```ts
readonly type: "conflict";
```

Discriminant for exhaustive diagnostic handling.

***

### kind?

```ts
readonly optional kind: TKind;
```

Helper kind containing the conflict.
