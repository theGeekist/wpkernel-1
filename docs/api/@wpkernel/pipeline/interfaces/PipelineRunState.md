[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineRunState

# Interface: PipelineRunState&lt;TArtifact, TDiagnostic&gt;

Default successful result returned by a pipeline.

## Remarks

`artifact` is the final user state. Diagnostics and steps are immutable views
of this run only. A custom result shape may be supplied through the required
`createRunResult` adapter in [AgnosticPipelineOptions](../type-aliases/AgnosticPipelineOptions.md).

## Type Parameters

### TArtifact

`TArtifact`

Final artifact or user-state type.

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

Diagnostic union collected by the run.

## Properties

### artifact

```ts
readonly artifact: TArtifact;
```

Final artifact after all stages, hooks and output adoption.

---

### diagnostics

```ts
readonly diagnostics: readonly TDiagnostic[];
```

Diagnostics recorded during registration or this run.

---

### steps

```ts
readonly steps: readonly PipelineStep&lt;string&gt;[];
```

Helpers that actually executed, in execution order.
