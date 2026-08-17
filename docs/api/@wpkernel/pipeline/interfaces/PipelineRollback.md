[**@wpkernel/pipeline v1.4.0**](../index.md)

---

[@wpkernel/pipeline](../index.md) / PipelineRollback

# Interface: PipelineRollback

A named cleanup operation captured after successful helper execution.

Helper rollbacks are admitted only after the helper settles successfully.
Extension hook rollback functions use the same execution machinery. On a
later pipeline failure, admitted operations run sequentially in reverse
execution chronology. This gives nested and dependency-ordered work LIFO
cleanup semantics.

Rollback is best effort. A failing operation is reported through the
pipeline's rollback observer, then the remaining older operations are still
attempted. Failures thrown by that observer are also contained. The original
pipeline failure remains primary.

Construct descriptors with [createPipelineRollback](../functions/createPipelineRollback.md). `key` and `label`
are diagnostic metadata and do not affect order or execution.

## Example

```ts
import {
  createPipelineRollback,
  type PipelineRollback,
} from '@wpkernel/pipeline';

const allocations = new Set(['temporary']);
const rollback: PipelineRollback = createPipelineRollback(
  () =&gt; allocations.delete('temporary'),
  { key: 'allocate', label: 'Release temporary allocation' }
);
```

## Properties

### run()

```ts
readonly run: () =&gt; unknown;
```

Cleanup operation invoked at most once by one rollback traversal.

#### Returns

`unknown`

---

### key?

```ts
readonly optional key: string;
```

Stable machine-readable owner key for diagnostics.

---

### label?

```ts
readonly optional label: string;
```

Human-readable cleanup description for observers.
