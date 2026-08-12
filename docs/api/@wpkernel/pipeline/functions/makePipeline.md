[**@wpkernel/pipeline v1.3.0**](../README.md)

***

[@wpkernel/pipeline](../README.md) / makePipeline

# Function: makePipeline()

```ts
function makePipeline&lt;TRunOptions, TContext, TReporter, TUserState, TDiagnostic, TRunResult, TKind&gt;(options): AgnosticPipeline&lt;TRunOptions, TRunResult, TContext, TReporter, TKind&gt;;
```

Creates an agnostic pipeline whose helper kinds, state and stage
sequence are supplied by [AgnosticPipelineOptions](../type-aliases/AgnosticPipelineOptions.md).

Without `createStages`, the runner executes one helper stage for each
`helperKinds` entry in declaration order, commits extension work, and
materialises the result. A custom stage factory can interleave typed helper
stages, extension lifecycle stages, commit checkpoints and custom state
transformations. Only configured helper kinds can be registered.

`createState` owns the run's initial user state. Helper-stage `writeOutput`
functions and custom stages control subsequent state adoption.
`createRunResult` adapts final user state, diagnostics, steps, context and run
options into a domain result. Without it, the result is
[PipelineRunState](../interfaces/PipelineRunState.md).

Helper and extension registration are pipeline configuration. Extension
registration may be synchronous or asynchronous, and registration can add
helpers. Each run waits until registration becomes quiescent, then captures
immutable helper orders and hooks. Additions after that boundary affect later
runs. A registration failure invalidates the pipeline instance and is
observed by every later run.

Diagnostics belong to one invocation. The diagnostic observer may stream
them through that invocation's reporter, but observer failures are contained.
Rollback failures are also reported without replacing the original run
failure or preventing remaining cleanup.

Execution preserves synchronous settlement. The returned pipeline's `run`
returns a plain result until a participating registration, helper, extension,
commit, rollback or custom stage becomes asynchronous.

## Type Parameters

### TRunOptions

`TRunOptions`

### TContext

`TContext` *extends* `object`

### TReporter

`TReporter` *extends* [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TUserState

`TUserState` = `unknown`

### TDiagnostic

`TDiagnostic` *extends* [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)&lt;`TUserState`, `TDiagnostic`&gt;

### TKind

`TKind` *extends* `string` = `string`

## Parameters

### options

[`AgnosticPipelineOptions`](../type-aliases/AgnosticPipelineOptions.md)&lt;`TRunOptions`, `TContext`, `TReporter`, `TUserState`, `TDiagnostic`, `TRunResult`, `TKind`&gt;

Context, state, stages, helper kinds and observer factories.

## Returns

[`AgnosticPipeline`](../interfaces/AgnosticPipeline.md)&lt;`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, `TKind`&gt;

A configured agnostic pipeline instance.

## Example

```ts
import { makePipeline } from '@wpkernel/pipeline';

const pipeline = makePipeline({
  helperKinds: ['compile'] as const,
  createContext: () =&gt; ({ reporter: console }),
  createState: () =&gt; ({ output: '' }),
  extensions: { lifecycles: ['after-compile'] },
  createStages: (stages) =&gt; [
    stages.makeHelperStage('compile'),
    stages.makeLifecycleStage('after-compile'),
    stages.finalizeResult,
  ],
});

pipeline.use(compileHelper);
const result = await pipeline.run({});
```
