// Types are strictly defined and validated by build, but ESLint flags generic resolution as any.
// runProgram removed
import type {
	AgnosticRunContext,
	AgnosticRunnerDependencies,
	AgnosticState,
	HelperExecutionSnapshot,
	Halt,
	PipelineStage,
	PipelineStepResult,
	RollbackEntry,
} from './types';
import type {
	PipelineReporter,
	PipelineDiagnostic,
	MaybePromise,
	PipelinePauseSnapshot,
	PipelinePaused,
} from '../types';
import { isPromiseLike, maybeThen, maybeTry } from '../async-utils';
import { createAgnosticStages } from './program';
import { isHalt, isPaused } from './stage-factories';
import { prepareResumeContext } from './context';
import { makeRollbackHandler } from './rollback';
import { commitPendingExtensions } from './commit';

const createEmptySnapshot = (
	kind: string
): HelperExecutionSnapshot<string> => ({
	kind,
	registered: [],
	executed: [],
	missing: [],
});

const applyStageIndex = <TState extends { stageIndex?: number }>(
	state: TState,
	stageIndex: number
): TState => ({
	...state,
	stageIndex,
});

/**
 * Public stages see only the supported stage-state facade. Merge their result
 * onto the preceding closed-world state so omitted runner-owned fields survive.
 * Internal stages still replace any hidden fields they explicitly return.
 * @param state
 * @param result
 */
const adoptStageState = <TState extends object>(
	state: TState,
	result: TState
): TState => ({
	...state,
	...result,
});

const finalizeRunState = <
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
	result: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>
): MaybePromise<TRunResult> => {
	return maybeThen(commitPendingExtensions(result), () =>
		dependencies.resolveRunResult({
			diagnostics: result.diagnostics as TDiagnostic[],
			steps: result.steps,
			context: result.context,
			userState: result.userState,
			options: result.runOptions,
			helpers: {
				fragments: createEmptySnapshot('dummy-fragment'),
				builders: createEmptySnapshot('dummy-builder'),
			},
			state: result,
		})
	);
};

const rollbackStateToHalt = <
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
	state: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>,
	error: unknown
): MaybePromise<Halt<TRunResult>> => {
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
};

const haltHasError = <TRunResult>(halt: Halt<TRunResult>): boolean =>
	halt.__hasError === true ||
	Object.prototype.hasOwnProperty.call(halt, 'error');

const rollbackUnhandledHalt = <
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
	state: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>,
	halt: Halt<TRunResult>
): MaybePromise<Halt<TRunResult>> => {
	if (!haltHasError(halt) || halt.__rollbackApplied) {
		return halt;
	}

	return rollbackStateToHalt(dependencies, state, halt.error);
};

const resolveTerminalStageResult = <TState extends object, TRunResult>(
	state: TState,
	result: unknown,
	onStageHalt?: (
		state: TState,
		halt: Halt<TRunResult>
	) => MaybePromise<Halt<TRunResult>>
): MaybePromise<Halt<TRunResult> | PipelinePaused<TState>> | undefined => {
	if (isHalt<TRunResult>(result)) {
		return onStageHalt ? onStageHalt(state, result) : result;
	}

	if (!isPaused<TState>(result)) {
		return undefined;
	}

	return {
		...result,
		snapshot: {
			...result.snapshot,
			state: adoptStageState(state, result.snapshot.state),
		},
	};
};

const finalizeRunWithRollback = <
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
	state: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>
): MaybePromise<TRunResult> =>
	maybeTry(
		() => finalizeRunState(dependencies, state),
		(error) =>
			maybeThen(rollbackStateToHalt(dependencies, state, error), () => {
				throw error;
			})
	);

const runStagesIteratively = <
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
>(
	stages: PipelineStage<
		AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		Halt<TRunResult>
	>[],
	initialState: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>,
	startIndex: number,
	onStageError?: (
		state: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		error: unknown
	) => MaybePromise<Halt<TRunResult>>,
	onStageHalt?: (
		state: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		halt: Halt<TRunResult>
	) => MaybePromise<Halt<TRunResult>>
): MaybePromise<
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
	const runFrom = (
		state: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		stageIndex: number
	): MaybePromise<
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
		let currentState = state;

		for (let index = stageIndex; index < stages.length; index += 1) {
			const stage = stages[index];
			if (!stage) {
				return currentState;
			}
			const stageState = applyStageIndex(currentState, index);
			let next;
			try {
				next = stage(stageState);
			} catch (error) {
				if (onStageError) {
					return onStageError(stageState, error);
				}
				throw error;
			}

			if (isPromiseLike(next)) {
				return Promise.resolve(next).then(
					(resolved) => {
						const terminal = resolveTerminalStageResult(
							stageState,
							resolved,
							onStageHalt
						);
						if (terminal) {
							return terminal;
						}
						return runFrom(
							adoptStageState(
								stageState,
								resolved as AgnosticState<
									TRunOptions,
									TUserState,
									TContext,
									TReporter,
									TDiagnostic
								>
							),
							index + 1
						);
					},
					(error: unknown) => {
						if (onStageError) {
							return onStageError(stageState, error);
						}
						throw error;
					}
				);
			}

			const terminal = resolveTerminalStageResult(
				stageState,
				next,
				onStageHalt
			);
			if (terminal) {
				return terminal;
			}

			currentState = adoptStageState(
				stageState,
				next as AgnosticState<
					TRunOptions,
					TUserState,
					TContext,
					TReporter,
					TDiagnostic
				>
			);
		}

		return currentState;
	};

	return runFrom(initialState, startIndex);
};

export const executeRun = <
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
): MaybePromise<TRunResult> => {
	const {
		runOptions,
		context,
	}: AgnosticRunContext<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	> = runContext;

	// AgnosticState is already prepared by prepareContext

	const initialState: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	> = runContext.state;

	if (!dependencies.stages) {
		return dependencies.resolveRunResult({
			diagnostics: [],
			steps: [],
			context,
			userState: initialState.userState,
			options: runOptions,
			helpers: {
				builders: createEmptySnapshot('dummy-builder'),
			},
			state: initialState,
		});
	}

	const stages = createAgnosticStages(dependencies, runContext);
	const runResult = runStagesIteratively(
		stages,
		initialState,
		0,
		(state, error) => rollbackStateToHalt(dependencies, state, error),
		(state, halt) => rollbackUnhandledHalt(dependencies, state, halt)
	);

	return maybeThen(
		runResult,
		(
			result:
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
		) => {
			if (isHalt(result)) {
				if (haltHasError(result)) {
					throw result.error;
				}
				return result.result!;
			}
			if (isPaused(result)) {
				const error = new Error(
					'Pipeline paused during executeRun. Use makeResumablePipeline to enable pause/resume.'
				);
				return maybeThen(
					rollbackStateToHalt(
						dependencies,
						result.snapshot.state,
						error
					),
					() => {
						throw error;
					}
				);
			}

			return finalizeRunWithRollback(dependencies, result);
		}
	);
};

export const executeRunWithPause = <
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
): MaybePromise<
	| TRunResult
	| PipelinePaused<
			AgnosticState<
				TRunOptions,
				TUserState,
				TContext,
				TReporter,
				TDiagnostic
			>
	  >
> => {
	const { runOptions, context } = runContext;

	const initialState = runContext.state;

	if (!dependencies.stages) {
		return dependencies.resolveRunResult({
			diagnostics: [],
			steps: [],
			context,
			userState: initialState.userState,
			options: runOptions,
			helpers: {
				builders: createEmptySnapshot('dummy-builder'),
			},
			state: initialState,
		});
	}

	const stages = createAgnosticStages(dependencies, runContext);
	const runResult = runStagesIteratively(
		stages,
		initialState,
		0,
		(state, error) => rollbackStateToHalt(dependencies, state, error),
		(state, halt) => rollbackUnhandledHalt(dependencies, state, halt)
	);

	return maybeThen(runResult, (result) => {
		if (isHalt(result)) {
			if (haltHasError(result)) {
				throw result.error;
			}
			return result.result!;
		}

		if (isPaused(result)) {
			return result;
		}

		return finalizeRunWithRollback(dependencies, result);
	});
};

export const executeResume = <
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
	snapshot: PipelinePauseSnapshot<
		AgnosticState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>
	>,
	resumeInput?: unknown
): MaybePromise<
	| TRunResult
	| PipelinePaused<
			AgnosticState<
				TRunOptions,
				TUserState,
				TContext,
				TReporter,
				TDiagnostic
			>
	  >
> => {
	if (!dependencies.stages) {
		return finalizeRunState(dependencies, snapshot.state);
	}

	const resumeContext = prepareResumeContext(dependencies, snapshot);
	const resumeState = {
		...resumeContext.state,
		resumeInput,
	};
	const stages = createAgnosticStages(dependencies, resumeContext);
	const runResult = runStagesIteratively(
		stages,
		resumeState,
		snapshot.stageIndex,
		(state, error) => rollbackStateToHalt(dependencies, state, error),
		(state, halt) => rollbackUnhandledHalt(dependencies, state, halt)
	);

	return maybeThen(runResult, (result) => {
		if (isHalt(result)) {
			if (haltHasError(result)) {
				throw result.error;
			}
			return result.result!;
		}

		if (isPaused(result)) {
			return result;
		}

		return finalizeRunWithRollback(dependencies, result);
	});
};
