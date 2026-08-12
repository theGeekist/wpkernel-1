[**@wpkernel/php-json-ast v0.12.6-beta.3**](../README.md)

***

[@wpkernel/php-json-ast](../README.md) / createHelper

# Function: createHelper()

```ts
function createHelper<TContext, TInput, TOutput, TReporter, TKind>(options): Helper<TContext, TInput, TOutput, TReporter, TKind>;
```

Creates a frozen [Helper](../interfaces/Helper.md) descriptor from declarative registration
metadata and an apply function.

The descriptor and a defensive copy of `dependsOn` are frozen. Mutating the
source options or dependency array after construction therefore cannot alter
registration identity or execution order. Objects captured by `apply` are
not cloned or frozen.

Dependencies always run first. Among helpers ready to run, ordering uses
descending priority, key and registration order. A dependency key waits for
every registered helper with that key. `extend` registrations may coexist.
Registering an `override`
removes earlier helpers with the same key; a second override is rejected.
These modes affect registration, not how `apply` composes output.

An apply function may mutate its supplied output and return `void`, or return
a result object containing an explicit replacement. The presence
of the `output` property is authoritative, including `{ output: undefined }`.
With no explicit call to HelperNext, the runner continues
automatically after `apply` settles and preserves the synchronous path when
every helper is synchronous.

Calling `next(output?)` turns the helper into an around-continuation. It runs
the downstream chain once, caches that result for repeated calls and lets the
current helper post-process the final downstream output. A later call cannot
replace the input chosen by the first call. If a helper launches asynchronous
downstream work and then fails, the runner observes downstream settlement
before propagating the helper's original failure. This lets downstream
rollback registration finish without replacing the primary error.

A rollback returned after successful helper settlement is admitted in helper
visitation order and later unwound in reverse order. Use
`createPipelineRollback` to attach diagnostic identity to cleanup.

## Type Parameters

### TContext

`TContext`

### TInput

`TInput`

### TOutput

`TOutput`

### TReporter

`TReporter` *extends* `PipelineReporter` = `PipelineReporter`

### TKind

`TKind` *extends* `string` = `string`

## Parameters

### options

[`CreateHelperOptions`](../interfaces/CreateHelperOptions.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`>

Helper identity, ordering metadata and apply behaviour.

## Returns

[`Helper`](../interfaces/Helper.md)<`TContext`, `TInput`, `TOutput`, `TReporter`, `TKind`>

A frozen descriptor with a frozen dependency list.

## Examples

```ts
import {
  createHelper,
  type PipelineReporter,
} from '@wpkernel/pipeline';

type Context = { reporter: PipelineReporter };

const normalise = createHelper<Context, string[], string[]>({
  key: 'normalise',
  kind: 'transform',
  dependsOn: ['parse'],
  priority: 20,
  apply: ({ output }) => ({
    output: output.map((value) => value.trim()),
  }),
});
```

```ts
import {
  createHelper,
  type PipelineReporter,
} from '@wpkernel/pipeline';

type Context = { reporter: PipelineReporter };

const bracket = createHelper<Context, string[], string[]>({
  key: 'bracket',
  kind: 'transform',
  apply: async ({ output }, next) => {
    const downstream = await next?.(['before', ...output]);
    return { output: [...(downstream ?? output), 'after'] };
  },
});
```

```ts
import {
  createHelper,
  createPipelineRollback,
  type PipelineReporter,
} from '@wpkernel/pipeline';

type Context = {
  reporter: PipelineReporter;
  allocated: Set<string>;
};

const allocate = createHelper<Context, void, string[]>({
  key: 'allocate',
  kind: 'build',
  apply: ({ context, output }) => {
    context.allocated.add('result');
    return {
      output: [...output, 'result'],
      rollback: createPipelineRollback(
        () => context.allocated.delete('result'),
        { key: 'allocate', label: 'Release result allocation' }
      ),
    };
  },
});
```
