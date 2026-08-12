import { createPipelineRuntime } from './pipeline-runtime';
import { maybeThen } from './async-utils';
import { initAgnosticResumableRunner } from './runner';
import { isPaused } from './runner/stage-factories';
import type { AgnosticState } from './runner/types';
import type {
	AgnosticPipelineOptions,
	HelperKind,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
	PipelinePauseSnapshot,
	PipelinePaused,
	PipelineStageState,
	ResumablePipeline,
} from './types';

/**
 * Creates a resumable form of {@link ResumablePipeline} for process-local
 * suspension of a custom stage sequence.
 *
 * Configuration, helper execution, extension lifecycles, diagnostics, result
 * adaptation and synchronous settlement follow {@link AgnosticPipelineOptions}.
 * Custom
 * stages additionally receive `pause` through their stage dependencies. A
 * pause stops before advancing the current stage index and returns a
 * {@link PipelinePaused} result containing an inspectable public state
 * projection.
 *
 * Each {@link PipelinePauseSnapshot} is an opaque capability bound to this
 * pipeline instance. It can be passed to {@link ResumablePipeline.resume}
 * exactly once. Claiming occurs before continuation starts, so a failed resume
 * still spends the capability. A snapshot from another pipeline, a copied
 * object, or an already claimed snapshot is rejected. If continuation pauses
 * again, that pause returns a new single-use capability.
 *
 * The projection exposes context, reporter, run options, user state, steps,
 * diagnostics and lifecycle progress for inspection. The authoritative state,
 * stage continuation and rollback journal remain private. Live values may be
 * present, so snapshots are neither serialisable durable checkpoints nor safe
 * to persist or transport.
 *
 * A fresh run waits for extension registration quiescence before capturing its
 * configuration. Resume continues the helper and extension snapshot captured
 * by the original run; registrations made after suspension affect later fresh
 * runs, not that continuation. Run and resume both return synchronously until
 * participating work becomes asynchronous.
 *
 * @example Pause once and resume with input
 * ```ts
 * import { makeResumablePipeline } from '@wpkernel/pipeline';
 *
 * const pipeline = makeResumablePipeline({
 *   helperKinds: [] as const,
 *   createContext: () => ({ reporter: console }),
 *   createState: () => ({ approved: false }),
 *   createStages: (stages) => [
 *     (state) => state.resumeInput
 *       ? { ...state, userState: { approved: true } }
 *       : stages.pause!(state, {
 *           pauseKind: 'approval',
 *           payload: { prompt: 'Approve?' },
 *         }),
 *     stages.finalizeResult,
 *   ],
 * });
 *
 * const paused = await pipeline.run({});
 * if ('__paused' in paused) {
 *   const result = await pipeline.resume(paused.snapshot, { approved: true });
 * }
 * ```
 *
 * @param options - Context, state, stages, helper kinds and observer factories.
 * @returns A configured resumable pipeline instance.
 * @see {@link PipelineStageState}
 * @public
 */
export function makeResumablePipeline<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TUserState = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TUserState, TDiagnostic>,
	TKind extends HelperKind = HelperKind,
>(
	options: AgnosticPipelineOptions<
		TRunOptions,
		TContext,
		TReporter,
		TUserState,
		TDiagnostic,
		TRunResult,
		TKind
	>
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
> {
	type PipelineState = AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	type PublicState = PipelineStageState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	type InternalSnapshot = PipelinePauseSnapshot<PipelineState>;
	type PublicSnapshot = PipelinePauseSnapshot<PublicState>;

	const runtime = createPipelineRuntime(options, { supportsPause: true });
	const runner = initAgnosticResumableRunner(runtime.runnerDependencies);
	const internalSnapshots = new WeakMap<object, InternalSnapshot>();
	const claimedSnapshots = new WeakSet<object>();
	const createPublicState = (state: PipelineState): PublicState =>
		({
			context: state.context,
			reporter: state.reporter,
			runOptions: state.runOptions,
			userState: state.userState,
			steps: [...state.steps],
			diagnostics: [...state.diagnostics],
			executedLifecycles: new Set(state.executedLifecycles),
			stageIndex: state.stageIndex,
			resumeInput: state.resumeInput,
		}) as unknown as PublicState;
	const ownPause = (
		result: TRunResult | PipelinePaused<PipelineState>
	): TRunResult | PipelinePaused<PublicState> => {
		if (isPaused<PipelineState>(result)) {
			const snapshot: PublicSnapshot = {
				stageIndex: result.snapshot.stageIndex,
				state: createPublicState(result.snapshot.state),
				token: result.snapshot.token,
				pauseKind: result.snapshot.pauseKind,
				createdAt: result.snapshot.createdAt,
				payload: result.snapshot.payload,
			};
			internalSnapshots.set(snapshot, result.snapshot);
			return { __paused: true, snapshot };
		}
		return result;
	};
	const claimSnapshot = (snapshot: object): InternalSnapshot => {
		const internalSnapshot = internalSnapshots.get(snapshot);
		if (!internalSnapshot) {
			throw new Error(
				'Pipeline pause snapshot does not belong to this pipeline.'
			);
		}
		if (claimedSnapshots.has(snapshot)) {
			throw new Error(
				'Pipeline pause snapshot has already been resumed.'
			);
		}
		claimedSnapshots.add(snapshot);
		return internalSnapshot;
	};

	const pipeline: ResumablePipeline<
		TRunOptions,
		TRunResult,
		TContext,
		TReporter,
		PublicState,
		TKind
	> = {
		extensions: {
			use: (extension) => runtime.registerExtension(pipeline, extension),
		},
		use: (helper) => runtime.registerHelper(helper),
		run: (runOptions) =>
			maybeThen(
				runtime.afterRegistrations(() =>
					runner.executeRun(runner.prepareContext(runOptions))
				),
				ownPause
			),
		resume: (snapshot, resumeInput) => {
			const internalSnapshot = claimSnapshot(snapshot);
			return maybeThen(
				runner.executeResume(internalSnapshot, resumeInput),
				ownPause
			);
		},
	};

	return pipeline;
}
