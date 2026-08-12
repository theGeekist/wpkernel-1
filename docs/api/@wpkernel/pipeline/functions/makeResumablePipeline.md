[**@wpkernel/pipeline v1.3.0**](../README.md)

---

[@wpkernel/pipeline](../README.md) / makeResumablePipeline

# Function: makeResumablePipeline()

```ts
function makeResumablePipeline<
	TRunOptions,
	TContext,
	TReporter,
	TUserState,
	TDiagnostic,
	TRunResult,
	TKind,
>(
	options
): ResumablePipeline<
	TRunOptions,
	TRunResult,
	TContext,
	TReporter,
	PipelineStageState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>,
	TKind
>;
```

Creates a resumable form of [ResumablePipeline](../interfaces/ResumablePipeline.md) for process-local
suspension of a custom stage sequence.

Configuration, helper execution, extension lifecycles, diagnostics, result
adaptation and synchronous settlement follow [AgnosticPipelineOptions](../type-aliases/AgnosticPipelineOptions.md).
Custom
stages additionally receive `pause` through their stage dependencies. A
pause stops before advancing the current stage index and returns a
[PipelinePaused](../interfaces/PipelinePaused.md) result containing an inspectable public state
projection.

Each [PipelinePauseSnapshot](../interfaces/PipelinePauseSnapshot.md) is an opaque capability bound to this
pipeline instance. It can be passed to [ResumablePipeline.resume](../interfaces/ResumablePipeline.md#resume)
exactly once. Claiming occurs before continuation starts, so a failed resume
still spends the capability. A snapshot from another pipeline, a copied
object, or an already claimed snapshot is rejected. If continuation pauses
again, that pause returns a new single-use capability.

The projection exposes context, reporter, run options, user state, steps,
diagnostics and lifecycle progress for inspection. The authoritative state,
stage continuation and rollback journal remain private. Live values may be
present, so snapshots are neither serialisable durable checkpoints nor safe
to persist or transport.

A fresh run waits for extension registration quiescence before capturing its
configuration. Resume continues the helper and extension snapshot captured
by the original run; registrations made after suspension affect later fresh
runs, not that continuation. Run and resume both return synchronously until
participating work becomes asynchronous.

## Type Parameters

### TRunOptions

`TRunOptions`

### TContext

`TContext` _extends_ `object`

### TReporter

`TReporter` _extends_ [`PipelineReporter`](../interfaces/PipelineReporter.md) = [`PipelineReporter`](../interfaces/PipelineReporter.md)

### TUserState

`TUserState` = `unknown`

### TDiagnostic

`TDiagnostic` _extends_ [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md) = [`PipelineDiagnostic`](../type-aliases/PipelineDiagnostic.md)

### TRunResult

`TRunResult` = [`PipelineRunState`](../interfaces/PipelineRunState.md)<`TUserState`, `TDiagnostic`>

### TKind

`TKind` _extends_ `string` = `string`

## Parameters

### options

[`AgnosticPipelineOptions`](../type-aliases/AgnosticPipelineOptions.md)<`TRunOptions`, `TContext`, `TReporter`, `TUserState`, `TDiagnostic`, `TRunResult`, `TKind`>

Context, state, stages, helper kinds and observer factories.

## Returns

[`ResumablePipeline`](../interfaces/ResumablePipeline.md)<`TRunOptions`, `TRunResult`, `TContext`, `TReporter`, [`PipelineStageState`](../interfaces/PipelineStageState.md)<`TRunOptions`, `TUserState`, `TContext`, `TReporter`, `TDiagnostic`>, `TKind`>

A configured resumable pipeline instance.

## Example

```ts
import { makeResumablePipeline } from '@wpkernel/pipeline';

const pipeline = makeResumablePipeline({
	helperKinds: [] as const,
	createContext: () => ({ reporter: console }),
	createState: () => ({ approved: false }),
	createStages: (stages) => [
		(state) =>
			state.resumeInput
				? { ...state, userState: { approved: true } }
				: stages.pause!(state, {
						pauseKind: 'approval',
						payload: { prompt: 'Approve?' },
					}),
		stages.finalizeResult,
	],
});

const paused = await pipeline.run({});
if ('__paused' in paused) {
	const result = await pipeline.resume(paused.snapshot, { approved: true });
}
```

## See

[PipelineStageState](../interfaces/PipelineStageState.md)
