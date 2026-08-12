import { maybeThen, processSequentially } from '../async-utils';
import { commitExtensionResults } from '../extensions';
import type { MaybePromise } from '../types';
import type { ExtensionLifecycleState } from './types';

export type ExtensionCommitState<TContext, TOptions, TArtifact> = {
	readonly extensionStack: ExtensionLifecycleState<
		TContext,
		TOptions,
		TArtifact
	>[];
	readonly committedExtensionStates: Set<
		ExtensionLifecycleState<TContext, TOptions, TArtifact>
	>;
};

/**
 * Commits every extension lifecycle state that has not already been committed
 * during the current run.
 *
 * Explicit commit stages and implicit finalization share this function, making
 * repeated commit checkpoints safe while retaining an implicit final commit.
 * @param state
 */
export function commitPendingExtensions<TContext, TOptions, TArtifact>(
	state: ExtensionCommitState<TContext, TOptions, TArtifact>
): MaybePromise<void> {
	return processSequentially(state.extensionStack, (extensionState) => {
		if (state.committedExtensionStates.has(extensionState)) {
			return;
		}

		return maybeThen(commitExtensionResults(extensionState.results), () => {
			state.committedExtensionStates.add(extensionState);
		});
	});
}
