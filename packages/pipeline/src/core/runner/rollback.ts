import { maybeThen, maybeTry, processSequentially } from '../async-utils';
import { createRollbackErrorMetadata, runRollbackStack } from '../rollback';
import { rollbackExtensionResults } from '../extensions';
import type {
	MaybePromise,
	PipelineExtensionRollbackErrorMetadata,
} from '../types';
import type {
	Halt,
	HelperRollbackPlan,
	RollbackContext,
	RollbackEntry,
} from './types';

/**
 * Executes a rollback plan for a helper stage failure.
 * It coordinates helper-specific rollbacks and extension rollbacks.
 * @param plan
 * @param error
 */
export function runHelperRollbackPlan<
	TContext,
	TOptions,
	TArtifact,
	THelper extends { key: string },
>(
	plan: HelperRollbackPlan<TContext, TOptions, TArtifact, THelper>
): MaybePromise<void> {
	const { context, rollbackContext, helperRollbacks, onHelperRollbackError } =
		plan;

	const rollbackExtensions = (): MaybePromise<void> =>
		processSequentially(
			rollbackContext.extensionStack,
			(extensionState) =>
				maybeTry(
					() =>
						rollbackExtensionResults(
							extensionState.results,
							extensionState.hooks,
							({ error, extensionKeys }) =>
								rollbackContext.onExtensionRollbackError?.({
									error,
									extensionKeys,
									errorMetadata:
										createRollbackErrorMetadata(error),
								})
						),
					() => undefined
				),
			'reverse'
		);

	const runHelperRollbacks = (): MaybePromise<void> =>
		maybeThen(
			runRollbackStack(
				helperRollbacks.map((entry: RollbackEntry<THelper>) => ({
					...entry.rollback,
					key: entry.helper.key,
				})),
				{
					source: 'helper',
					onError: ({
						error: rbError,
						metadata,
						entry,
					}: {
						error: unknown;
						metadata: PipelineExtensionRollbackErrorMetadata;
						entry: { key?: string };
					}) => {
						const helperEntry = helperRollbacks.find(
							(candidate: RollbackEntry<THelper>) =>
								candidate.helper.key === (entry.key ?? '')
						);
						if (helperEntry && onHelperRollbackError) {
							onHelperRollbackError({
								error: rbError,
								helper: helperEntry.helper,
								errorMetadata: metadata,
								context,
							});
						}
					},
				}
			),
			rollbackExtensions
		);

	const swallowRollbackFailure = () => undefined;

	return maybeTry(runHelperRollbacks, swallowRollbackFailure);
}

export function runRollbackToHalt<
	TRunResult,
	TContext,
	TOptions,
	TArtifact,
	THelper extends { key: string },
>(
	rollbackPlan: HelperRollbackPlan<TContext, TOptions, TArtifact, THelper>,
	halt: (error?: unknown) => Halt<TRunResult>,
	error: unknown
): MaybePromise<Halt<TRunResult>> {
	return maybeThen(runHelperRollbackPlan(rollbackPlan), () => ({
		...halt(error),
		__hasError: true,
		__rollbackApplied: true,
	}));
}

export function rollbackStateToHalt<
	TRunResult,
	TContext,
	TOptions,
	TArtifact,
	THelper extends { key: string },
>(
	state: RollbackContext<TContext, TOptions, TArtifact> & {
		readonly helperRollbackStack: RollbackEntry<THelper>[];
	},
	error: unknown,
	halt: (error?: unknown) => Halt<TRunResult>,
	onHelperRollbackError?: (options: {
		readonly error: unknown;
		readonly helper: THelper;
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void
): MaybePromise<Halt<TRunResult>> {
	return runRollbackToHalt(
		{
			context: state.context,
			rollbackContext: state,
			helperRollbacks: state.helperRollbackStack,
			onHelperRollbackError,
		},
		halt,
		error
	);
}
