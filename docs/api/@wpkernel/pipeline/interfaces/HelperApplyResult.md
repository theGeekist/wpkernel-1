[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / HelperApplyResult

# Interface: HelperApplyResult&lt;TOutput&gt;

Optional transformation and compensation produced by a helper.

## Remarks

Omitting `output` preserves the current output. A rollback is registered only
after the helper completes successfully. Registered rollbacks participate in
the pipeline's global reverse-completion transaction chronology.

## Type Parameters

### TOutput

`TOutput`

Replacement output type for the helper phase.

## Properties

### output?

```ts
readonly optional output: TOutput;
```

Replacement passed to downstream helpers and later stages.

---

### rollback?

```ts
readonly optional rollback: PipelineRollback;
```

Compensation to execute if later work causes the run to fail.
