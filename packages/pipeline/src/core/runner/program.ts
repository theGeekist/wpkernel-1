import { maybeThen } from '../async-utils.js';
import type {
	AgnosticRunnerDependencies,
	AgnosticRunContext,
	AgnosticState,
	Halt,
	HelperStageSpec,
	PipelineStage,
	RollbackEntry,
} from './types.js';
import {
	isHalt,
	isPaused,
	makeHelperStageFactory,
	makeGuardedStage,
	makeCommitStage,
} from './stage-factories.js';
import type { RegisteredHelper } from '../dependency-graph.js';
import type {
	PipelineReporter,
	PipelineDiagnostic,
	MaybePromise,
	PipelineExtensionLifecycle,
	Helper,
	PipelinePauseOptions,
	PipelinePauseSnapshot,
	PipelinePaused,
	HelperApplyResult,
	HelperNext,
	PipelineStageDependencies,
	PipelineStage as PublicPipelineStage,
	PipelineStageState,
} from '../types.js';
import {
	appendExtensionRollbackSegment,
	appendHelperRollbackSegment,
	rollbackStateToHalt,
} from './rollback.js';
import { commitPendingExtensions } from './commit.js';
import { runExtensionHooks } from '../extensions/index.js';
import { createRollbackErrorMetadata } from '../rollback.js';
import { rollbackJournalState } from './state.js';

const readStageIndex = (state: { stageIndex?: number }): number =>
	state.stageIndex ?? 0;

const createPauseSnapshot = <TState>(
	state: TState,
	options?: PipelinePauseOptions
): PipelinePauseSnapshot<TState> => ({
	stageIndex: readStageIndex(state as { stageIndex?: number }),
	state,
	token: options?.token,
	pauseKind: options?.pauseKind,
	payload: options?.payload,
	createdAt: Date.now(),
});

const createPaused = <TState>(
	state: TState,
	options?: PipelinePauseOptions
): PipelinePaused<TState> => ({
	__paused: true,
	snapshot: createPauseSnapshot(state, options),
});

export const createAgnosticStages = <
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
>(
	dependencies: AgnosticRunnerDependencies<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic,
		TRunResult
	>,
	runContext: AgnosticRunContext<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>
): PipelineStage<
	AgnosticState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>,
	Halt<TRunResult>
>[] => {
	type RunnerState = AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	type RunnerResult =
		| RunnerState
		| Halt<TRunResult>
		| PipelinePaused<RunnerState>;
	type RunnerProgram = (state: RunnerResult) => MaybePromise<RunnerResult>;
	type PublicState = PipelineStageState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	type PublicDependencies = PipelineStageDependencies<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic,
		TRunResult,
		string
	>;
	const diagnosticManager = runContext.state.diagnosticManager;

	const halt = (error: unknown): Halt<TRunResult> => ({
		__halt: true,
		__hasError: true,
		error,
	});

	// Generic makeArgs factory
	const defaultMakeArgs =
		(state: RunnerState) => (_entry: RegisteredHelper<unknown>) => ({
			context: state.context,
			input: state.runOptions,
			output: state.userState,
			reporter: state.reporter,
		});

	// Runner Environment shared by all stages
	const runnerEnv = {
		pushStep: runContext.pushStep,
		toRollbackContext: (state: RunnerState) => ({
			context: state.context,
			[rollbackJournalState]: state[rollbackJournalState],
			onExtensionRollbackError: state.onExtensionRollbackError,
		}),
		halt,
		pause: dependencies.options.supportsPause
			? (state: RunnerState, options?: PipelinePauseOptions) =>
					createPaused(state, options)
			: undefined,
		isHalt,
		onHelperRollbackError: dependencies.options.onHelperRollbackError,
	};

	// --- Stage Factories ---

	const makeStage = makeHelperStageFactory<
		RunnerState,
		TRunResult,
		TContext,
		TRunOptions,
		TReporter,
		TUserState
	>(runnerEnv);

	const makeHelperStage = (
		kind: string,
		spec?: {
			makeArgs?: (
				state: RunnerState
			) => (entry: RegisteredHelper<unknown>) => unknown;
			onVisited?: (
				state: RunnerState,
				visited: Set<string>,
				rollbacks: unknown[],
				output: unknown
			) => RunnerState;
			writeOutput?: (state: RunnerState, output: unknown) => RunnerState;
		}
	): RunnerProgram => {
		const stageSpec = {
			getOrder: (state: RunnerState) =>
				state.helperOrders.get(kind) ?? [],
			makeArgs: spec?.makeArgs ?? defaultMakeArgs,
			onVisited: (
				state: RunnerState,
				visited: Set<string>,
				rollbacks: unknown[],
				output: unknown
			): RunnerState => {
				const visitedState =
					spec?.onVisited?.(state, visited, rollbacks, output) ??
					state;
				return {
					...visitedState,
					[rollbackJournalState]: state[rollbackJournalState],
				};
			},
			writeRollbacks: (
				state: RunnerState,
				rollbacks: unknown[],
				initialState: RunnerState
			) => ({
				...state,
				[rollbackJournalState]: appendHelperRollbackSegment(
					initialState[rollbackJournalState],
					rollbacks as RollbackEntry<{ readonly key: string }>[]
				),
			}),
			invoke: ({
				helper,
				args,
				next,
			}: {
				helper: unknown;
				args: unknown;
				next: HelperNext<unknown>;
			}): MaybePromise<HelperApplyResult<unknown> | void> => {
				if (
					typeof helper === 'object' &&
					helper !== null &&
					'apply' in helper &&
					typeof (helper as Record<string, unknown>).apply ===
						'function'
				) {
					return (
						(helper as Record<string, unknown>).apply as (
							options: unknown,
							next: HelperNext<unknown>
						) => MaybePromise<HelperApplyResult<unknown> | void>
					)(args, next);
				}

				// Should be unreachable if registry validates helpers
				throw new Error(
					`Invalid helper: expected object with .apply method. Got: ${typeof helper}`
				);
			},
			writeOutput:
				spec === undefined
					? (state: RunnerState, output: unknown) => ({
							...state,
							userState: output as TUserState,
						})
					: spec.writeOutput,
		};

		// Type assertion required because stageSpec is built dynamically and
		// TypeScript cannot infer the full generic relationship at compile time.
		return makeStage(
			kind,
			stageSpec as unknown as HelperStageSpec<
				RunnerState,
				TContext,
				TReporter,
				string,
				Helper<TContext, unknown, unknown, TReporter, string>,
				unknown,
				unknown
			>
		);
	};

	const makeLifecycleStage = (lifecycle: string): RunnerProgram =>
		makeGuardedStage<RunnerState, Halt<TRunResult>>({
			isHalt,
			isPaused,
			execute: (state) => {
				// runContext.buildHookOptions expects AgnosticState (RunnerState)
				const hookOptions = runContext.buildHookOptions(
					state,
					lifecycle as unknown as PipelineExtensionLifecycle
				);

				const lifecycleHooks = state.extensionHooks.filter(
					(entry) => entry.lifecycle === lifecycle
				);
				return maybeThen(
					runExtensionHooks(
						state.extensionHooks,
						lifecycle as unknown as PipelineExtensionLifecycle,
						hookOptions,
						({ error, extensionKeys }) =>
							state.onExtensionRollbackError?.({
								error,
								extensionKeys,
								errorMetadata:
									createRollbackErrorMetadata(error),
							})
					),
					(result) => {
						const executedLifecycles = new Set(
							state.executedLifecycles
						);
						executedLifecycles.add(lifecycle);
						const newExtensionState = {
							artifact: result.artifact,
							results: result.results,
							hooks: lifecycleHooks,
						};
						return {
							...state,
							executedLifecycles,
							[rollbackJournalState]:
								appendExtensionRollbackSegment(
									state[rollbackJournalState],
									newExtensionState
								),
							extensionStack: [
								...state.extensionStack,
								newExtensionState,
							],
							userState: newExtensionState.artifact,
						};
					}
				);
			},
		});

	// Commit Stage using the factory
	const commitStage: RunnerProgram = makeCommitStage<
		RunnerState,
		Halt<TRunResult>
	>({
		isHalt,
		isPaused,
		commit: (state) => commitPendingExtensions(state),
		rollbackToHalt: (state, error) =>
			rollbackStateToHalt(
				state,
				error,
				halt,
				dependencies.options.onHelperRollbackError
			),
	});

	const finalizeResultProgram: RunnerProgram = makeGuardedStage<
		RunnerState,
		Halt<TRunResult>
	>({
		isHalt,
		isPaused,
		execute: (state) => {
			const nextState = {
				...state,
				diagnostics: diagnosticManager.getDiagnostics(),
			};

			// Validate Ignored Hooks
			if (nextState.extensionHooks.length > 0) {
				const visited = nextState.executedLifecycles;
				const ignoredLifecycles = new Set<string>();

				for (const hook of nextState.extensionHooks) {
					if (!visited.has(hook.lifecycle)) {
						ignoredLifecycles.add(hook.lifecycle);
					}
				}

				if (ignoredLifecycles.size > 0) {
					const ignoredList = Array.from(ignoredLifecycles)
						.map((l) => `"${l}"`)
						.join(', ');
					try {
						nextState.reporter.warn?.(
							`The following extension hooks will be ignored because their lifecycles were not executed: ${ignoredList}`
						);
					} catch {
						// Reporters observe execution but cannot change its result.
					}
				}
			}

			return nextState;
		},
	});

	const toPublicStage = (
		stage: RunnerProgram
	): PublicPipelineStage<PublicState, TRunResult> =>
		stage as unknown as PublicPipelineStage<PublicState, TRunResult>;
	type InternalHelperStageSpec = NonNullable<
		Parameters<typeof makeHelperStage>[1]
	>;

	const deps: PublicDependencies = {
		finalizeResult: toPublicStage(finalizeResultProgram),
		makeLifecycleStage: (lifecycle) =>
			toPublicStage(makeLifecycleStage(lifecycle)),
		commitStage: toPublicStage(commitStage),
		makeHelperStage: ((
			kind: string,
			publicSpec?: {
				makeArgs?: (
					state: PublicState
				) => (entry: RegisteredHelper<unknown>) => unknown;
				writeOutput?: (
					state: PublicState,
					output: unknown
				) => PublicState;
				onVisited?: (
					state: PublicState,
					visited: ReadonlySet<string>,
					registered: readonly RegisteredHelper<unknown>[],
					rollbacks: readonly RollbackEntry<unknown>[],
					output: unknown
				) => PublicState;
			}
		) => {
			const internalSpec: Parameters<typeof makeHelperStage>[1] =
				publicSpec
					? {
							makeArgs:
								publicSpec.makeArgs as InternalHelperStageSpec['makeArgs'],
							writeOutput:
								publicSpec.writeOutput as InternalHelperStageSpec['writeOutput'],
							onVisited: (state, visited, rollbacks, output) =>
								(publicSpec.onVisited?.(
									state as unknown as PublicState,
									visited,
									state.helperOrders.get(kind) ?? [],
									rollbacks as RollbackEntry<unknown>[],
									output
								) ?? state) as unknown as RunnerState,
						}
					: undefined;
			return toPublicStage(makeHelperStage(kind, internalSpec));
		}) as PublicDependencies['makeHelperStage'],
		halt,
		pause: runnerEnv.pause
			? (state, options) =>
					runnerEnv.pause!(
						state as unknown as RunnerState,
						options
					) as unknown as PipelinePaused<PublicState>
			: undefined,
		isHalt,
		diagnostics: {
			record: (diagnostic) => diagnosticManager.record(diagnostic),
			flagUnusedHelper: (helper, kind, message, dependsOn) =>
				diagnosticManager.flagUnusedHelper(
					helper,
					kind,
					message,
					dependsOn ?? []
				),
		},
		extensions: {
			lifecycles: dependencies.extensionLifecycles,
		},
	};

	return dependencies.stages(deps) as PipelineStage<
		RunnerState,
		Halt<TRunResult>
	>[];
};
