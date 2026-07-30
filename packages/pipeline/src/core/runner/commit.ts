import { maybeThen } from '../async-utils';
import type { MaybePromise } from '../types';
import type { ExtensionCoordinator, ExtensionLifecycleState } from './types';

type ExtensionCommitEntry<TContext, TOptions, TArtifact> = {
	readonly coordinator: ExtensionCoordinator<TContext, TOptions, TArtifact>;
	readonly state: ExtensionLifecycleState<TContext, TOptions, TArtifact>;
};

export type ExtensionCommitState<TContext, TOptions, TArtifact> = {
	readonly extensionCoordinator?: ExtensionCoordinator<
		TContext,
		TOptions,
		TArtifact
	>;
	readonly extensionState?: ExtensionLifecycleState<
		TContext,
		TOptions,
		TArtifact
	>;
	readonly extensionStack?: Array<
		ExtensionCommitEntry<TContext, TOptions, TArtifact>
	>;
	readonly committedExtensionStates?: Set<
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
	const committed =
		state.committedExtensionStates ??
		new Set<ExtensionLifecycleState<TContext, TOptions, TArtifact>>();

	if (!state.committedExtensionStates) {
		(
			state as {
				committedExtensionStates: Set<
					ExtensionLifecycleState<TContext, TOptions, TArtifact>
				>;
			}
		).committedExtensionStates = committed;
	}

	let entries = state.extensionStack ?? [];
	if (
		entries.length === 0 &&
		state.extensionCoordinator &&
		state.extensionState
	) {
		entries = [
			{
				coordinator: state.extensionCoordinator,
				state: state.extensionState,
			},
		];
	}

	return entries.reduce<MaybePromise<void>>(
		(previous, entry) =>
			maybeThen(previous, () => {
				if (committed.has(entry.state)) {
					return;
				}

				return maybeThen(entry.coordinator.commit(entry.state), () => {
					committed.add(entry.state);
				});
			}),
		undefined
	);
}
