import type {
	AgnosticRunContext,
	AgnosticRunnerDependencies,
	AgnosticState,
	Halt,
	PipelineStage,
	PipelineStepResult,
} from './types.js';
import type {
	PipelineReporter,
	PipelineDiagnostic,
	MaybePromise,
	PipelinePauseSnapshot,
	PipelinePaused,
} from '../types.js';
import { adoptMaybePromise, maybeThen, maybeTry } from '../async-utils.js';
import { createAgnosticStages } from './program.js';
import { isHalt, isPaused } from './stage-factories.js';
import { prepareResumeContext } from './context.js';
import { rollbackStateToHalt as rollbackRunStateToHalt } from './rollback.js';
import { commitPendingExtensions } from './commit.js';
import { isRollbackApplied } from './state.js';

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

const terminalHaltKind = Symbol('pipeline.terminal-halt');

type TerminalHalt<TRunResult> =
	| {
			readonly [terminalHaltKind]: 'result';
			readonly result: TRunResult;
	  }
	| { readonly [terminalHaltKind]: 'bare' }
	| {
			readonly [terminalHaltKind]: 'error';
			readonly error: unknown;
			readonly rollbackApplied: boolean;
	  };

const isTerminalHalt = <TRunResult>(
	value: unknown
): value is TerminalHalt<TRunResult> =>
	Boolean(value && typeof value === 'object' && terminalHaltKind in value);

/**
 * Classify the permissive public halt shape once at the stage boundary. Error
 * presence deliberately wins over a result to preserve the established halt
 * semantics, including an explicitly supplied `undefined` error.
 * @param halt
 */
const classifyHalt = <TRunResult>(
	halt: Halt<TRunResult>
): TerminalHalt<TRunResult> => {
	const hasError =
		halt.__hasError === true ||
		Object.prototype.hasOwnProperty.call(halt, 'error');

	if (hasError) {
		return {
			[terminalHaltKind]: 'error',
			error: halt.error,
			rollbackApplied: isRollbackApplied(halt),
		};
	}

	return Object.prototype.hasOwnProperty.call(halt, 'result')
		? {
				[terminalHaltKind]: 'result',
				result: halt.result as TRunResult,
			}
		: { [terminalHaltKind]: 'bare' };
};

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
	halt: TerminalHalt<TRunResult>
): MaybePromise<TerminalHalt<TRunResult>> => {
	if (halt[terminalHaltKind] !== 'error' || halt.rollbackApplied) {
		return halt;
	}

	return maybeThen(
		rollbackStateToHalt(dependencies, state, halt.error),
		classifyHalt
	);
};

const resolveTerminalStageResult = <TState extends object, TRunResult>(
	state: TState,
	result: unknown,
	onStageHalt: (
		state: TState,
		halt: TerminalHalt<TRunResult>
	) => MaybePromise<TerminalHalt<TRunResult>>
):
	| MaybePromise<TerminalHalt<TRunResult> | PipelinePaused<TState>>
	| undefined => {
	if (isHalt<TRunResult>(result)) {
		const terminal = classifyHalt(result);
		return onStageHalt(state, terminal);
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
	onStageError: (
		state: TState,
		error: unknown
	) => MaybePromise<TerminalHalt<TRunResult>>,
	onStageHalt: (
		state: TState,
		halt: TerminalHalt<TRunResult>
	) => MaybePromise<TerminalHalt<TRunResult>>
): MaybePromise<TState | PipelinePaused<TState> | TerminalHalt<TRunResult>> => {
	const runFrom = (
		state: TState,
		stageIndex: number
	): MaybePromise<
		TState | PipelinePaused<TState> | TerminalHalt<TRunResult>
	> => {
		let currentState = state;

		for (let index = stageIndex; index < stages.length; index += 1) {
			const stage = stages[index]!;
			const stageState = applyStageIndex(currentState, index);
			const continueFromResult = (
				resolved:
					| PipelineStepResult<TState, TRunResult>
					| TerminalHalt<TRunResult>
			) => {
				if (isTerminalHalt<TRunResult>(resolved)) {
					return resolved;
				}
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
			const handleStageError = (error: unknown) =>
				onStageError(stageState, error);
			const continueSafely = (
				resolved:
					| PipelineStepResult<TState, TRunResult>
					| TerminalHalt<TRunResult>
			) =>
				maybeTry<
					TState | PipelinePaused<TState> | TerminalHalt<TRunResult>
				>(() => continueFromResult(resolved), handleStageError);
			const next = adoptMaybePromise(
				maybeTry<
					| PipelineStepResult<TState, TRunResult>
					| TerminalHalt<TRunResult>
				>(() => stage(stageState), handleStageError)
			);

			if (next.promise !== null) {
				return next.promise.then((resolved) => {
					const continued = continueSafely(resolved);
					return maybeThen(continued, (nextState) =>
						isTerminalHalt<TRunResult>(nextState) ||
						isPaused<TState>(nextState)
							? nextState
							: runFrom(nextState, index + 1)
					);
				});
			}

			const continued = adoptMaybePromise(continueSafely(next.value));
			if (continued.promise !== null) {
				return continued.promise.then((resolved) =>
					isTerminalHalt<TRunResult>(resolved) ||
					isPaused<TState>(resolved)
						? resolved
						: runFrom(resolved, index + 1)
				);
			}
			if (
				isTerminalHalt<TRunResult>(continued.value) ||
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
		(state, error) =>
			maybeThen(
				rollbackStateToHalt(dependencies, state, error),
				classifyHalt
			),
		(state, halt) => rollbackUnhandledHalt(dependencies, state, halt)
	);

	return maybeThen(runResult, (result) => {
		if (isTerminalHalt<TRunResult>(result)) {
			if (result[terminalHaltKind] === 'error') {
				throw result.error;
			}
			return result[terminalHaltKind] === 'result'
				? result.result
				: (undefined as TRunResult);
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
