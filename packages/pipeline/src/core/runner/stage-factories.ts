import { maybeThen, maybeTry } from '../async-utils.js';
import { executeHelpers } from '../execution-utils.js';
import type { PipelineRollback } from '../rollback.js';
import type {
	Helper,
	HelperApplyResult,
	HelperApplyOptions,
	HelperKind,
	HelperNext,
	HelperExecutionSnapshot,
	MaybePromise,
	PipelinePaused,
	PipelineReporter,
} from '../types.js';
import type { RegisteredHelper } from '../dependency-graph.js';
import type {
	Halt,
	HelperInvokeOptions,
	RollbackEntry,
	StageEnv,
	HelperStageSpec,
	HelperRollbackPlan,
} from './types.js';
import { runRollbackToHalt } from './rollback.js';

export function isHalt<TRunResult>(value: unknown): value is Halt<TRunResult> {
	return Boolean(
		value &&
			typeof value === 'object' &&
			'__halt' in value &&
			(value as { __halt?: unknown }).__halt === true
	);
}

export function isPaused<TState>(
	value: unknown
): value is PipelinePaused<TState> {
	return Boolean(
		value &&
			typeof value === 'object' &&
			'__paused' in value &&
			(value as { __paused?: unknown }).__paused === true
	);
}

/**
 * Generic stage constructor that executes an ordered helper list with middleware-style `next()`.
 * @param options
 * @param options.getOrder
 * @param options.makeArgs
 * @param options.invoke
 * @param options.recordStep
 * @param options.onVisited
 * @param options.registerRollback
 * @param options.writeOutput
 */
export function createHelpersProgram<
	TContext,
	TReporter extends PipelineReporter,
	TKind extends HelperKind,
	THelper extends Helper<TContext, TInput, TOutput, TReporter, TKind>,
	TInput,
	TOutput,
	TState,
>(options: {
	getOrder: (state: TState) => RegisteredHelper<THelper>[];
	makeArgs: (
		state: TState
	) => (
		entry: RegisteredHelper<THelper>
	) => HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
	invoke: (
		invokeOptions: HelperInvokeOptions<
			THelper,
			TInput,
			TOutput,
			TContext,
			TReporter
		>
	) => MaybePromise<HelperApplyResult<TOutput> | void>;
	recordStep: (entry: RegisteredHelper<unknown>) => void;
	writeOutput?: (state: TState, output: TOutput) => TState;
	onVisited: (state: TState, visited: Set<string>, output: TOutput) => TState;
	registerRollback?: (
		helper: THelper,
		result: unknown,
		executionIndex: number
	) => void;
}): (state: TState) => MaybePromise<TState> {
	const {
		getOrder,
		makeArgs,
		invoke,
		recordStep,
		writeOutput,
		onVisited,
		registerRollback,
	} = options;

	const invokeWithOptionalRollback = (
		helper: THelper,
		args: HelperApplyOptions<TContext, TInput, TOutput, TReporter>,
		next: HelperNext<TOutput>,
		executionIndex: number
	): MaybePromise<HelperApplyResult<TOutput> | void> => {
		const invocation = invoke({ helper, args, next });

		return registerRollback
			? maybeThen(invocation, (resolved) => {
					registerRollback(helper, resolved, executionIndex);
					return resolved;
				})
			: invocation;
	};

	return (state) => {
		const order = getOrder(state);
		const visitedOrPromise = executeHelpers<
			TContext,
			TInput,
			TOutput,
			TReporter,
			TKind,
			THelper,
			HelperApplyOptions<TContext, TInput, TOutput, TReporter>
		>(order, makeArgs(state), invokeWithOptionalRollback, recordStep);

		return maybeThen(visitedOrPromise, (result) => {
			const outputState =
				result.hasOutput && writeOutput
					? writeOutput(state, result.output)
					: state;
			return onVisited(outputState, result.visited, result.output);
		});
	};
}

type GuardedStageOptions<TState, THalt extends Halt<unknown>> = {
	isHalt: (value: TState | THalt) => value is THalt;
	isPaused?: (value: unknown) => value is PipelinePaused<TState>;
	execute: (state: TState) => MaybePromise<TState | THalt>;
};

export const makeGuardedStage =
	<TState, THalt extends Halt<unknown>>({
		isHalt: isHaltState,
		isPaused: isPausedState,
		execute,
	}: GuardedStageOptions<TState, THalt>): ((
		state: TState | THalt | PipelinePaused<TState>
	) => MaybePromise<TState | THalt | PipelinePaused<TState>>) =>
	(state) => {
		if (
			(isPausedState && isPausedState(state)) ||
			isHaltState(state as TState | THalt)
		) {
			return state;
		}

		return execute(state as TState);
	};

/**
 * Commit stage builder.
 * @param options
 * @param options.isHalt
 * @param options.commit
 * @param options.rollbackToHalt
 * @param options.isPaused
 */
export function makeCommitStage<TState, THalt extends Halt<unknown>>(options: {
	isHalt: (value: TState | THalt) => value is THalt;
	isPaused?: (value: unknown) => value is PipelinePaused<TState>;
	commit: (state: TState) => MaybePromise<void>;
	rollbackToHalt: (state: TState, error: unknown) => MaybePromise<THalt>;
}): (
	state: TState | THalt | PipelinePaused<TState>
) => MaybePromise<TState | THalt | PipelinePaused<TState>> {
	const {
		isHalt: isHaltState,
		isPaused: isPausedState,
		commit,
		rollbackToHalt,
	} = options;

	const runCommit = (state: TState): MaybePromise<TState | THalt> => {
		const onCommitSuccess = (): TState | THalt => state;
		const onCommitError = (error: unknown): MaybePromise<TState | THalt> =>
			rollbackToHalt(state, error) as MaybePromise<TState | THalt>;

		return maybeTry<TState | THalt>(
			() => maybeThen(commit(state), onCommitSuccess),
			onCommitError
		);
	};

	return makeGuardedStage({
		isHalt: isHaltState,
		isPaused: isPausedState,
		execute: runCommit,
	});
}

export function makeHelperStageFactory<
	TState,
	TRunResult,
	TContext,
	TOptions,
	TReporter extends PipelineReporter,
	TUserState,
>(config: StageEnv<TState, TRunResult, TContext, TOptions, TUserState>) {
	return function makeStage<
		TKind extends HelperKind,
		THelper extends Helper<TContext, TInput, TOutput, TReporter, TKind>,
		TInput,
		TOutput,
	>(
		kind: string,
		spec: HelperStageSpec<
			TState,
			TContext,
			TReporter,
			TKind,
			THelper,
			TInput,
			TOutput
		>
	): (
		state: TState | Halt<TRunResult> | PipelinePaused<TState>
	) => MaybePromise<TState | Halt<TRunResult> | PipelinePaused<TState>> {
		const {
			pushStep,
			toRollbackContext,
			halt,
			isHalt: isHaltState,
			onHelperRollbackError,
		} = config;

		const invokeHelper =
			spec.invoke ??
			(({
				helper,
				args,
				next,
			}: {
				helper: THelper;
				args: HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
				next: HelperNext<TOutput>;
			}): MaybePromise<HelperApplyResult<TOutput> | void> =>
				helper.apply(args, next));

		const registerPipelineRollback = (
			rollbacks: RollbackEntry<THelper>[]
		) => {
			const stageRollbacks = new Map<number, RollbackEntry<THelper>>();

			return (
				helper: THelper,
				result: unknown,
				executionIndex: number
			) => {
				if (!result || typeof result !== 'object') {
					return;
				}
				if ('rollback' in result) {
					const rollback = (result as { rollback?: PipelineRollback })
						.rollback;
					if (rollback) {
						stageRollbacks.set(executionIndex, {
							helper,
							rollback,
						});
						const ordered = Array.from(stageRollbacks.entries())
							.sort(([left], [right]) => left - right)
							.map(([, entry]) => entry);
						rollbacks.splice(0, rollbacks.length, ...ordered);
					}
				}
			};
		};

		return (state) => {
			if (isHaltState(state)) {
				return state;
			}
			if (isPaused<TState>(state)) {
				return state;
			}

			const ordered = spec.getOrder(state as TState);
			const helperExecution = new Map(
				(
					state as TState & {
						readonly helperExecution?: ReadonlyMap<
							string,
							HelperExecutionSnapshot
						>;
					}
				).helperExecution
			);
			const execution: HelperExecutionSnapshot<TKind> = {
				kind: kind as TKind,
				registered: ordered.map((entry) => entry.helper.key),
				executed: [],
				missing: [],
			};
			helperExecution.set(kind, execution);
			const stateWithExecution = {
				...(state as TState),
				helperExecution,
			} as TState;

			const rollbacks: RollbackEntry<THelper>[] = [];

			const rollbackContext = toRollbackContext(state as TState);
			const program = createHelpersProgram<
				TContext,
				TReporter,
				TKind,
				THelper,
				TInput,
				TOutput,
				TState
			>({
				getOrder: () => ordered,
				makeArgs: spec.makeArgs,
				invoke: invokeHelper,
				recordStep: (entry) => {
					pushStep(entry);
					(execution.executed as string[]).push(
						(entry.helper as { readonly key: string }).key
					);
				},
				writeOutput: spec.writeOutput,
				onVisited: (nextState, visited, output) => {
					const admittedState = spec.writeRollbacks
						? spec.writeRollbacks(
								nextState,
								rollbacks,
								state as TState
							)
						: nextState;
					return spec.onVisited(
						admittedState,
						visited,
						rollbacks,
						output
					);
				},
				registerRollback: registerPipelineRollback(rollbacks),
			});

			const rollbackPlan: HelperRollbackPlan<
				TContext,
				TOptions,
				TUserState,
				THelper
			> = {
				context: rollbackContext.context,
				rollbackContext,
				helperRollbacks: rollbacks,
				onHelperRollbackError,
			};

			return maybeTry<TState | Halt<TRunResult>>(
				() => program(stateWithExecution),
				(error) =>
					runRollbackToHalt<
						TRunResult,
						TContext,
						TOptions,
						TUserState,
						THelper
					>(rollbackPlan, halt, error)
			);
		};
	};
}
