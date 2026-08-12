import { maybeThen, maybeTry, processSequentially } from '../async-utils';
import { createRollbackErrorMetadata, runRollbackStack } from '../rollback';
import { rollbackExtensionResults } from '../extensions';
import type {
	MaybePromise,
	PipelineExtensionRollbackErrorMetadata,
} from '../types';
import type { PipelineRollback } from '../rollback';
import type {
	ExtensionLifecycleState,
	Halt,
	HelperRollbackPlan,
	RollbackContext,
	RollbackEntry,
	RollbackJournalEntry,
} from './types';

export function appendHelperRollbackSegment<
	TContext,
	TOptions,
	TArtifact,
	THelper extends { readonly key: string },
>(
	journal: RollbackJournalEntry<TContext, TOptions, TArtifact>[],
	entries: readonly RollbackEntry<THelper>[]
): RollbackJournalEntry<TContext, TOptions, TArtifact>[] {
	return entries.length === 0
		? journal
		: [...journal, { source: 'helper', entries }];
}

export function appendExtensionRollbackSegment<TContext, TOptions, TArtifact>(
	journal: RollbackJournalEntry<TContext, TOptions, TArtifact>[],
	state: ExtensionLifecycleState<TContext, TOptions, TArtifact>
): RollbackJournalEntry<TContext, TOptions, TArtifact>[] {
	return state.results.some((execution) => execution.result.rollback)
		? [...journal, { source: 'extension', state }]
		: journal;
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

			const helperRollbacks: readonly {
				readonly helper: { readonly key: string };
				readonly rollback: PipelineRollback;
			}[] = entry.entries.map(({ helper, rollback }) => ({
				helper,
				rollback: {
					key: rollback.key,
					label: rollback.label,
					run: () => rollback.run(),
				},
			}));
			const helperByRollback = new Map(
				helperRollbacks.map(({ helper, rollback }) => [
					rollback,
					helper,
				])
			);
			return runRollbackStack(
				helperRollbacks.map(({ rollback }) => rollback),
				{
					source: 'helper',
					onError: ({ error, metadata, entry: rollback }) => {
						const helper = helperByRollback.get(rollback);
						if (helper) {
							onHelperRollbackError?.({
								error,
								helper,
								errorMetadata: metadata,
								context,
							});
						}
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
		[...rollbackContext.rollbackJournal],
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
	halt: (error?: unknown) => Halt<TRunResult>,
	error: unknown
): MaybePromise<Halt<TRunResult>> {
	return maybeThen(runHelperRollbackPlan(rollbackPlan), () => ({
		...halt(error),
		__hasError: true,
		__rollbackApplied: true,
	}));
}

export function rollbackStateToHalt<TRunResult, TContext, TOptions, TArtifact>(
	state: RollbackContext<TContext, TOptions, TArtifact>,
	error: unknown,
	halt: (error?: unknown) => Halt<TRunResult>,
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
