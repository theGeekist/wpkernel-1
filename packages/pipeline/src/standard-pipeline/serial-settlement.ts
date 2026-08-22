import { createRollbackErrorMetadata } from '../core/rollback.js';
import { observeParticipant } from '../v2/scheduler/maybe-promise.js';
import { invokePublic } from './serial-invoke.js';
import type {
	PreparedSerialRun,
	SerialJournalEntry,
} from './serial-authority.js';

type SettlementPhase = 'commit' | 'rollback';
interface SettlementTraversal {
	readonly prepared: PreparedSerialRun;
	readonly direction: 1 | -1;
	readonly phase: SettlementPhase;
}
type RetainedFailure =
	| { readonly present: false }
	| { readonly present: true; readonly error: unknown };

const noRetainedFailure: RetainedFailure = Object.freeze({ present: false });

function invokeJournalParticipant(participant: unknown) {
	try {
		return observeParticipant(
			Reflect.apply(
				participant as (...args: never[]) => unknown,
				undefined,
				[]
			)
		);
	} catch (error) {
		return { kind: 'failed' as const, error };
	}
}

function notifyRollbackObserver(
	prepared: PreparedSerialRun,
	entry: SerialJournalEntry,
	rollbackOptions: unknown
): void {
	try {
		if (entry.source === 'helper') {
			if (prepared.authority.onHelperRollbackError) {
				invokePublic(
					prepared.authority.onHelperRollbackError,
					rollbackOptions
				);
			}
		} else if (prepared.authority.onExtensionRollbackError) {
			invokePublic(
				prepared.authority.onExtensionRollbackError,
				rollbackOptions
			);
		}
	} catch {
		// Rollback observers cannot stop remaining compensation.
	}
}

function warnRollbackFailure(
	prepared: PreparedSerialRun,
	entry: SerialJournalEntry,
	rollbackOptions: Record<string, unknown>,
	errorMetadata: ReturnType<typeof createRollbackErrorMetadata>
): void {
	try {
		const reporter = (
			prepared.context as
				| {
						readonly reporter?: {
							readonly warn?: (
								message: string,
								details: unknown
							) => void;
						};
				  }
				| undefined
		)?.reporter;
		if (entry.source === 'helper') {
			if (reporter?.warn) {
				invokePublic(
					reporter.warn,
					'Helper rollback failed',
					rollbackOptions
				);
			}
		} else if (reporter?.warn) {
			invokePublic(reporter.warn, 'Pipeline extension rollback failed.', {
				...rollbackOptions,
				extensions: rollbackOptions.extensionKeys,
				errorName: errorMetadata.name,
				errorMessage: errorMetadata.message,
				errorStack: errorMetadata.stack,
				errorCause: errorMetadata.cause,
				...errorMetadata,
			});
		}
	} catch {
		// Reporter failures cannot stop remaining compensation.
	}
}

function reportRollbackFailure(
	prepared: PreparedSerialRun,
	entry: SerialJournalEntry,
	error: unknown
): void {
	const errorMetadata = createRollbackErrorMetadata(error);
	const rollbackOptions =
		entry.source === 'helper'
			? {
					error,
					helper: entry.owner,
					errorMetadata,
					context: prepared.context,
				}
			: {
					error,
					extensionKeys:
						entry.extensionKeys ??
						Object.freeze([
							(entry.owner as { readonly key: string }).key,
						]),
					errorMetadata,
					context: prepared.context,
				};
	notifyRollbackObserver(prepared, entry, rollbackOptions);
	warnRollbackFailure(prepared, entry, rollbackOptions, errorMetadata);
}

function continueAfterFailure(
	traversal: SettlementTraversal,
	index: number,
	firstFailure: RetainedFailure,
	error: unknown
): void | Promise<void> {
	const { prepared, direction, phase } = traversal;
	if (phase === 'commit') {
		throw error;
	}
	reportRollbackFailure(prepared, prepared.journal[index]!, error);
	return settleJournalAt(
		traversal,
		index + direction,
		firstFailure.present ? firstFailure : { present: true, error }
	);
}

function settleJournalAt(
	traversal: SettlementTraversal,
	index: number,
	firstFailure: RetainedFailure = noRetainedFailure
): void | Promise<void> {
	const { prepared, direction, phase } = traversal;
	if (index < 0 || index >= prepared.journal.length) {
		if (firstFailure.present) {
			throw firstFailure.error;
		}
		return;
	}
	const entry = prepared.journal[index]!;
	const participant = phase === 'commit' ? entry.commit : entry.rollback;
	if (!Object.prototype.hasOwnProperty.call(entry, phase)) {
		return settleJournalAt(traversal, index + direction, firstFailure);
	}
	const observed = invokeJournalParticipant(participant);
	if (observed.kind === 'failed') {
		return continueAfterFailure(
			traversal,
			index,
			firstFailure,
			observed.error
		);
	}
	if (observed.kind === 'synchronous') {
		return settleJournalAt(traversal, index + direction, firstFailure);
	}
	return observed.promise.then(
		() => settleJournalAt(traversal, index + direction, firstFailure),
		(error: unknown) => {
			return continueAfterFailure(traversal, index, firstFailure, error);
		}
	);
}

export function commitSerialRun(
	prepared: PreparedSerialRun
): void | Promise<void> {
	return settleJournalAt({ prepared, direction: 1, phase: 'commit' }, 0);
}

export function compensateSerialRun(
	prepared: PreparedSerialRun
): void | Promise<void> {
	return settleJournalAt(
		{ prepared, direction: -1, phase: 'rollback' },
		prepared.journal.length - 1
	);
}
