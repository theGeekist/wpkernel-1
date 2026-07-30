import { composeK, maybeThen, type Program } from '../async-utils';
import type {
	AgnosticRunnerDependencies,
	AgnosticRunContext,
	AgnosticState,
	Halt,
	HelperStageSpec,
	PipelineStage,
	PipelineStepResult,
	RollbackEntry,
} from './types';
import {
	isHalt,
	isPaused,
	makeHelperStageFactory,
	makeFinalizeResultStage,
	makeAfterFragmentsStage,
	makeCommitStage,
} from './stage-factories';
import type { RegisteredHelper } from '../dependency-graph';
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
} from '../types';
import { makeRollbackHandler } from './rollback';
import { commitPendingExtensions } from './commit';

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
	type RunnerProgram = Program<RunnerResult>;
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
	type InternalDependencies = PublicDependencies & {
		readonly runnerEnv: typeof runnerEnv;
		readonly diagnosticManager: typeof diagnosticManager;
	};
	const diagnosticManager =
		runContext.diagnosticManager ?? dependencies.diagnosticManager;

	const halt = (...errors: [error?: unknown]): Halt<TRunResult> =>
		errors.length === 0
			? { __halt: true }
			: {
					__halt: true,
					__hasError: true,
					error: errors[0],
				};

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
			extensionCoordinator: state.extensionCoordinator,
			extensionState: state.extensionState,
			extensionStack: state.extensionStack,
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
	>({
		pushStep: runContext.pushStep,
		toRollbackContext: (state) => ({
			context: state.context,
			extensionCoordinator: state.extensionCoordinator,
			extensionState: state.extensionState,
			extensionStack: state.extensionStack,
		}),
		halt,
		isHalt,
		onHelperRollbackError: dependencies.options.onHelperRollbackError,
	});

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
		},
		createHelperArgs?: (args: {
			state: RunnerState;
			helper: unknown;
			context: TContext;
		}) => unknown
	): RunnerProgram => {
		// Construct the full stage spec
		const stageSpec = {
			getOrder: (state: RunnerState) =>
				state.helperOrders?.get(kind) ?? [],
			makeArgs: defaultMakeArgs,
			onVisited: (
				state: RunnerState,
				visited: Set<string>,
				rollbacks: unknown[],
				output: unknown
			): RunnerState => {
				return spec?.onVisited
					? spec.onVisited(state, visited, rollbacks, output)
					: state;
			},
			writeRollbacks: (state: RunnerState, rollbacks: unknown[]) => ({
				...state,
				helperRollbackStack:
					rollbacks as RunnerState['helperRollbackStack'],
			}),
			readRollbacks: (state: RunnerState) =>
				state.helperRollbackStack ?? [],
			invoke: ({
				helper,
				args,
				next,
			}: {
				helper: unknown;
				args: unknown;
				next: HelperNext<unknown>;
			}): MaybePromise<HelperApplyResult<unknown> | void> => {
				// Handle both Helper objects (with apply method) and direct functions
				if (typeof helper === 'function') {
					return (
						helper as (
							options: unknown,
							next: HelperNext<unknown>
						) => MaybePromise<HelperApplyResult<unknown> | void>
					)(args, next);
				}

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
					`Invalid helper: expected function or object with .apply method. Got: ${typeof helper}`
				);
			},
			writeOutput: spec
				? spec.writeOutput
				: (state: RunnerState, output: unknown) => ({
						...state,
						userState: output as TUserState,
					}),
			...spec,
		};

		// Override makeArgs only if provided or createHelperArgs is present
		if (spec?.makeArgs) {
			stageSpec.makeArgs = spec.makeArgs;
		} else if (createHelperArgs) {
			// Adapter-like makeArgs wrapping createHelperArgs
			stageSpec.makeArgs =
				(state: RunnerState) => (entry: RegisteredHelper<unknown>) =>
					createHelperArgs({
						state,
						helper: entry.helper,
						context: state.context,
					});
		}
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
		makeAfterFragmentsStage<RunnerState, Halt<TRunResult>>({
			isHalt,
			isPaused,
			execute: (state) => {
				state.executedLifecycles.add(lifecycle);
				const coordinator = state.extensionCoordinator;
				if (!coordinator) {
					return state;
				}

				// runContext.buildHookOptions expects AgnosticState (RunnerState)
				const hookOptions = runContext.buildHookOptions(
					state,
					lifecycle as unknown as PipelineExtensionLifecycle
				);

				return maybeThen(
					coordinator.runLifecycle(
						lifecycle as unknown as PipelineExtensionLifecycle,
						{
							hooks: dependencies.extensionHooks,
							hookOptions,
						}
					),
					(newExtensionState) => ({
						...state,
						extensionState: newExtensionState,
						extensionStack: [
							...(state.extensionStack ?? []),
							{
								coordinator,
								state: newExtensionState,
							},
						],
						userState: newExtensionState.artifact,
					})
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
		rollbackToHalt: (state, error) => {
			const rollback = makeRollbackHandler<
				TContext,
				TRunOptions,
				TUserState,
				{ readonly key: string }
			>(
				{
					context: state.context,
					extensionCoordinator: state.extensionCoordinator,
					extensionState: state.extensionState,
					extensionStack: state.extensionStack,
				},
				(state.helperRollbackStack ?? []) as RollbackEntry<{
					readonly key: string;
				}>[],
				dependencies.options.onHelperRollbackError
			);

			return maybeThen(rollback(error), () => ({
				__halt: true,
				__hasError: true,
				__rollbackApplied: true,
				error,
			}));
		},
	});

	const finalizeResultProgram: RunnerProgram = makeFinalizeResultStage<
		RunnerState,
		Halt<TRunResult>
	>({
		isHalt,
		isPaused,
		finalize: (state) => {
			const s = state;
			const nextState = {
				...s,
				diagnostics: diagnosticManager.readDiagnostics(),
			} as unknown as RunnerState;

			// Validate Ignored Hooks
			if (dependencies.extensionHooks.length > 0) {
				const visited = nextState.executedLifecycles;
				const ignoredLifecycles = new Set<string>();

				for (const hook of dependencies.extensionHooks) {
					if (!visited?.has(hook.lifecycle)) {
						ignoredLifecycles.add(hook.lifecycle);
					}
				}

				if (ignoredLifecycles.size > 0) {
					// We warn via reporter
					const ignoredList = Array.from(ignoredLifecycles)
						.map((l) => `"${l}"`)
						.join(', ');
					nextState.reporter.warn?.(
						`The following extension hooks will be ignored because their lifecycles were not executed: ${ignoredList}`
					);
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

	const deps: InternalDependencies = {
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
			},
			createHelperArgs?: Parameters<typeof makeHelperStage>[2]
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
									state.helperOrders?.get(kind) ?? [],
									rollbacks as RollbackEntry<unknown>[],
									output
								) ?? state) as unknown as RunnerState,
						}
					: undefined;
			return toPublicStage(
				makeHelperStage(kind, internalSpec, createHelperArgs)
			);
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
		runnerEnv,
		diagnosticManager,
	};

	if (!dependencies.stages) {
		throw new Error(
			"Agnostic Runner requires 'stages' factory to be defined."
		);
	}

	return dependencies.stages(deps) as PipelineStage<
		RunnerState,
		Halt<TRunResult>
	>[];
};

export const createAgnosticProgram = <
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
): Program<
	PipelineStepResult<
		AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>
> => {
	const stages = createAgnosticStages(dependencies, runContext);
	return composeK<
		| AgnosticState<
				TRunOptions,
				TUserState,
				TContext,
				TReporter,
				TDiagnostic
		  >
		| Halt<TRunResult>
		| PipelinePaused<
				AgnosticState<
					TRunOptions,
					TUserState,
					TContext,
					TReporter,
					TDiagnostic
				>
		  >
	>(...[...stages].reverse());
};
