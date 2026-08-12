[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / MissingDependencyDiagnostic

# Interface: MissingDependencyDiagnostic&lt;TKind&gt;

Fatal diagnostic emitted when a declared dependency cannot be satisfied.

## Remarks

Keys listed in `AgnosticPipelineOptions.providedKeys` satisfy external
dependencies and therefore do not produce this diagnostic.

## Type Parameters

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Helper-kind union associated with the diagnostic.

## Properties

### dependency

```ts
readonly dependency: string;
```

Missing prerequisite key.

***

### key

```ts
readonly key: string;
```

Key of the helper declaring the dependency.

***

### message

```ts
readonly message: string;
```

Human-readable description.

***

### type

```ts
readonly type: "missing-dependency";
```

Discriminant for exhaustive diagnostic handling.

***

### helper?

```ts
readonly optional helper: string;
```

Origin or key identifying the affected helper.

***

### kind?

```ts
readonly optional kind: TKind;
```

Helper kind whose graph was invalid.
