[**@wpkernel/pipeline v1.4.0**](../index.md)

***

[@wpkernel/pipeline](../index.md) / createPipelineRollback

# Function: createPipelineRollback()

```ts
function createPipelineRollback(run, options): PipelineRollback;
```

Creates a [PipelineRollback](../interfaces/PipelineRollback.md) descriptor for helper-owned cleanup.

This function performs no work and does not register the descriptor by
itself. Return it as `rollback` from a helper result; the pipeline admits it
only when that helper settles successfully. Admitted operations run in
reverse execution chronology if a later stage fails.

The returned descriptor is a shallow object containing the original `run`
function and optional diagnostic metadata. It is not frozen. A synchronous
`run` keeps rollback on the synchronous path until an asynchronous cleanup is
encountered. Cleanup failures are contained by the pipeline so older
rollbacks are still attempted, while the original run error remains primary.

## Parameters

### run

() =&gt; `unknown`

Cleanup to invoke if later pipeline work fails.

### options

Optional identity for diagnostics and rollback observers.

#### key?

`string`

Stable machine-readable owner key.

#### label?

`string`

Human-readable cleanup description.

## Returns

[`PipelineRollback`](../interfaces/PipelineRollback.md)

A rollback descriptor containing the supplied function and metadata.

## Example

```ts
import {
  createHelper,
  createPipelineRollback,
  type PipelineReporter,
} from '@wpkernel/pipeline';

type Context = {
  reporter: PipelineReporter;
  cache: Map&lt;string, string&gt;;
};

const cacheResult = createHelper&lt;Context, void, string&gt;({
  key: 'cache-result',
  kind: 'build',
  apply: ({ context, output }) =&gt; {
    const previous = context.cache.get('result');
    context.cache.set('result', output);

    return {
      rollback: createPipelineRollback(
        () =&gt; {
          if (previous === undefined) context.cache.delete('result');
          else context.cache.set('result', previous);
        },
        { key: 'cache-result', label: 'Restore cached result' }
      ),
    };
  },
});
```
