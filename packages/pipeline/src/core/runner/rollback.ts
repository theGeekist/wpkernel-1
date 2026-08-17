import { maybeThen, maybeTry, processSequentially } from '../async-utils.js';
import { createRollbackErrorMetadata, runRollbackStack } from '../rollback.js';
import { rollbackExtensionResults } from '../extensions/index.js';
import type {
	MaybePromise,
	PipelineExtensionRollbackErrorMetadata,
} from '../types.js';
import type { PipelineRollback } from '../rollback.js';
import type {
	ExtensionLifecycleState,
	Halt,
	HelperRollbackPlan,
	RollbackContext,
	RollbackEntry,
	RollbackJournalEntry,
} from './types.js';
import { markRollbackApplied, rollbackJournalState } from './state.js';

const snapshotRollback = (rollback: PipelineRollback): PipelineRollback =>
	Object.freeze({
		key: rollback.key,
		label: rollback.label,
		run: rollback.run,
	});

export function appendHelperRollbackSegment<
	TContext,
	TOptions,
	TArtifact,
	THelper extends { readonly key: string },
>(
	journal: readonly RollbackJournalEntry<TContext, TOptions, TArtifact>[],
	entries: readonly RollbackEntry<THelper>[]
): RollbackJournalEntry<TContext, TOptions, TArtifact>[] {
	return entries.length === 0
		? [...journal]
		: [
				...journal,
				Object.freeze({
					source: 'helper' as const,
					entries: Object.freeze(
						entries.map(({ helper, rollback }) =>
							Object.freeze({
								helper,
								rollback: snapshotRollback(rollback),
							})
						)
					),
				}),
			];
}

export function appendExtensionRollbackSegment<TContext, TOptions, TArtifact>(
	journal: readonly RollbackJournalEntry<TContext, TOptions, TArtifact>[],
	state: ExtensionLifecycleState<TContext, TOptions, TArtifact>
): RollbackJournalEntry<TContext, TOptions, TArtifact>[] {
	if (!state.results.some((execution) => execution.result.rollback)) {
		return [...journal];
	}

	const admittedState = Object.freeze({
		artifact: state.artifact,
		results: Object.freeze([...state.results]),
		hooks: Object.freeze([...state.hooks]),
	});
	return [
		...journal,
		Object.freeze({ source: 'extension' as const, state: admittedState }),
	];
}

function runRollbackJournal<TContext, TOptions, TArtifact>(
	context: TContext,
	journal: readonly RollbackJournalEntry<TContext, TOptions, TArtifact>[],
	onHelperRollbackError?: HelperRollbackPlan<
		TContext,
		TOptions,
		TArtifact,
		{ readonly key: string }
	>['onHelperRollbackError'],
	onExtensionRollbackError?: RollbackContext<
		TContext,
		TOptions,
		TArtifact
	>['onExtensionRollbackError']
): MaybePromise<void> {
	return processSequentially(
		journal,
		(entry) => {
			if (entry.source === 'extension') {
				return rollbackExtensionResults(
					entry.state.results,
					entry.state.hooks,
					({ error, extensionKeys }) =>
						onExtensionRollbackError?.({
							error,
							extensionKeys,
							errorMetadata: createRollbackErrorMetadata(error),
						})
				);
			}

			const helperRollbacks = entry.entries.map(
				({ helper, rollback }) => ({
					helper,
					rollback: snapshotRollback(rollback),
				})
			);
			const helperByRollback = new Map(
				helperRollbacks.map(({ helper, rollback }) => [
					rollback,
					helper,
				])
			);
			return runRollbackStack(
				helperRollbacks.map(({ rollback }) => rollback),
				{
					onError: ({ error, metadata, entry: rollback }) => {
						onHelperRollbackError?.({
							error,
							helper: helperByRollback.get(rollback)!,
							errorMetadata: metadata,
							context,
						});
					},
				}
			);
		},
		'reverse'
	);
}

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
	const journal = appendHelperRollbackSegment(
		rollbackContext[rollbackJournalState],
		helperRollbacks
	);

	const swallowRollbackFailure = () => undefined;

	return maybeTry(
		() =>
			runRollbackJournal(
				context,
				journal,
				onHelperRollbackError,
				rollbackContext.onExtensionRollbackError
			),
		swallowRollbackFailure
	);
}

export function runRollbackToHalt<
	TRunResult,
	TContext,
	TOptions,
	TArtifact,
	THelper extends { key: string },
>(
	rollbackPlan: HelperRollbackPlan<TContext, TOptions, TArtifact, THelper>,
	halt: (error: unknown) => Halt<TRunResult>,
	error: unknown
): MaybePromise<Halt<TRunResult>> {
	return maybeThen(runHelperRollbackPlan(rollbackPlan), () =>
		markRollbackApplied(halt(error))
	);
}

export function rollbackStateToHalt<TRunResult, TContext, TOptions, TArtifact>(
	state: RollbackContext<TContext, TOptions, TArtifact>,
	error: unknown,
	halt: (error: unknown) => Halt<TRunResult>,
	onHelperRollbackError?: (options: {
		readonly error: unknown;
		readonly helper: { readonly key: string };
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void
): MaybePromise<Halt<TRunResult>> {
	return runRollbackToHalt(
		{
			context: state.context,
			rollbackContext: state,
			helperRollbacks: [],
			onHelperRollbackError,
		},
		halt,
		error
	);
}
