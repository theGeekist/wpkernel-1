[**@wpkernel/pipeline v2.0.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / PipelineAdmissionFailure

# Interface: PipelineAdmissionFailure

Algebraic rejection of one caller-owned run-admission field.

## Properties

### error

```ts
readonly error: GraphSchedulerError;
```

***

### field

```ts
readonly field: "pipeline" | "options" | "inputs" | "capabilities" | "signal";
```

***

### kind

```ts
readonly kind: "admission-failed";
```
