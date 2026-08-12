// Types are strictly defined and validated by build, but ESLint flags generic resolution as any.
// runProgram removed
import type {
	AgnosticRunContext,
	AgnosticRunnerDependencies,
	AgnosticState,
	Halt,
	PipelineStage,
	PipelineStepResult,
} from './types';
import type {
	PipelineReporter,
	PipelineDiagnostic,
	MaybePromise,
	PipelinePauseSnapshot,
	PipelinePaused,
} from '../types';
import { adoptMaybePromise, maybeThen, maybeTry } from '../async-utils';
import { createAgnosticStages } from './program';
import { isHalt, isPaused } from './stage-factories';
import { prepareResumeContext } from './context';
import { rollbackStateToHalt as rollbackRunStateToHalt } from './rollback';
import { commitPendingExtensions } from './commit';

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
			diagnostics: result.diagnostics,
			steps: result.steps,
			context: result.context,
			userState: result.userState,
			options: result.runOptions,
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
	return rollbackRunStateToHalt(
		state,
		error,
		(failure) => ({
			__halt: true,
			__hasError: true,
			error: failure,
		}),
		dependencies.options.onHelperRollbackError
	);
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
	TState extends { readonly stageIndex?: number },
	TRunResult,
>(
	stages: PipelineStage<TState, Halt<TRunResult>>[],
	initialState: TState,
	startIndex: number,
	onStageError?: (
		state: TState,
		error: unknown
	) => MaybePromise<Halt<TRunResult>>,
	onStageHalt?: (
		state: TState,
		halt: Halt<TRunResult>
	) => MaybePromise<Halt<TRunResult>>
): MaybePromise<PipelineStepResult<TState, TRunResult>> => {
	const runFrom = (
		state: TState,
		stageIndex: number
	): MaybePromise<PipelineStepResult<TState, TRunResult>> => {
		let currentState = state;

		for (let index = stageIndex; index < stages.length; index += 1) {
			const stage = stages[index];
			if (!stage) {
				return currentState;
			}
			const stageState = applyStageIndex(currentState, index);
			const continueFromResult = (
				resolved: PipelineStepResult<TState, TRunResult>
			) => {
				const terminal = resolveTerminalStageResult(
					stageState,
					resolved,
					onStageHalt
				);
				if (terminal) {
					return terminal;
				}

				return adoptStageState(stageState, resolved as TState);
			};
			const handleStageError = (error: unknown) => {
				if (onStageError) {
					return onStageError(stageState, error);
				}
				throw error;
			};
			const next = adoptMaybePromise(
				maybeTry(() => stage(stageState), handleStageError)
			);

			if (next.promise !== null) {
				return next.promise.then((resolved) => {
					const continued = continueFromResult(resolved);
					return maybeThen(continued, (nextState) =>
						isHalt<TRunResult>(nextState) ||
						isPaused<TState>(nextState)
							? nextState
							: runFrom(nextState, index + 1)
					);
				});
			}

			const continued = adoptMaybePromise(continueFromResult(next.value));
			if (continued.promise !== null) {
				return continued.promise.then((resolved) =>
					isHalt<TRunResult>(resolved) || isPaused<TState>(resolved)
						? resolved
						: runFrom(resolved, index + 1)
				);
			}
			if (
				isHalt<TRunResult>(continued.value) ||
				isPaused(continued.value)
			) {
				return continued.value;
			}
			currentState = continued.value;
		}

		return currentState;
	};

	return runFrom(initialState, startIndex);
};

const executePreparedRun = <
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
	>,
	startIndex: number,
	allowPause: boolean
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
	const initialState = runContext.state;
	const stages = createAgnosticStages(dependencies, runContext);
	const runResult = runStagesIteratively(
		stages,
		initialState,
		startIndex,
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
			if (allowPause) {
				return result;
			}
			const error = new Error(
				'Pipeline paused during executeRun. Use makeResumablePipeline to enable pause/resume.'
			);
			return maybeThen(
				rollbackStateToHalt(dependencies, result.snapshot.state, error),
				() => {
					throw error;
				}
			);
		}

		return finalizeRunWithRollback(dependencies, result);
	});
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
): MaybePromise<TRunResult> =>
	executePreparedRun(
		dependencies,
		runContext,
		0,
		false
	) as MaybePromise<TRunResult>;

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
) => executePreparedRun(dependencies, runContext, 0, true);

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
	const resumeContext = prepareResumeContext(dependencies, snapshot);
	return executePreparedRun(
		dependencies,
		{
			...resumeContext,
			state: {
				...resumeContext.state,
				resumeInput,
			},
		},
		snapshot.stageIndex,
		true
	);
};
