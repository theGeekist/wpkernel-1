[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / UnusedHelperDiagnostic

# Interface: UnusedHelperDiagnostic&lt;TKind&gt;

Diagnostic describing a registered helper that did not execute.

## Remarks

Custom stage compositions decide whether and when to report unused helpers
through [PipelineStageDiagnostics.flagUnusedHelper](PipelineStageDiagnostics.md#flagunusedhelper).

## Type Parameters

### TKind

`TKind` *extends* [`HelperKind`](../type-aliases/HelperKind.md) = [`HelperKind`](../type-aliases/HelperKind.md)

Helper-kind union associated with the diagnostic.

## Properties

### key

```ts
readonly key: string;
```

Registered helper key.

***

### message

```ts
readonly message: string;
```

Human-readable explanation of why it was considered unused.

***

### type

```ts
readonly type: "unused-helper";
```

Discriminant for exhaustive diagnostic handling.

***

### dependsOn?

```ts
readonly optional dependsOn: readonly string[];
```

Dependencies relevant to the non-execution diagnosis.

***

### helper?

```ts
readonly optional helper: string;
```

Origin or key identifying the helper.

***

### kind?

```ts
readonly optional kind: TKind;
```

Helper kind containing the registration.
