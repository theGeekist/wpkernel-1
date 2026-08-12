[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / PipelineRollbackErrorMetadata

# Interface: PipelineRollbackErrorMetadata

Best-effort diagnostic metadata extracted from a rollback failure.

Every field is optional because hostile `Error` instances can throw while
their properties are inspected. Metadata extraction never replaces the
original rollback error and never interrupts the remaining cleanup.
String failures populate only `message`; values that cannot be safely read
produce an empty object.

## See

 - [PipelineRollback](PipelineRollback.md)
 - [createPipelineRollback](../functions/createPipelineRollback.md)

## Properties

### cause?

```ts
readonly optional cause: unknown;
```

Original causal value from an `Error` with a readable `cause`.

***

### message?

```ts
readonly optional message: string;
```

Error or string failure message when it can be read safely.

***

### name?

```ts
readonly optional name: string;
```

Error constructor name when it can be read safely.

***

### stack?

```ts
readonly optional stack: string;
```

Captured stack text when the failure exposes one safely.
