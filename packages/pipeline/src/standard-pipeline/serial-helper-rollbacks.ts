import type { HelperApplyResult } from '../core/types.js';
import type { ErasedHelper, SerialJournalEntry } from './serial-authority.js';

export interface PendingHelperRollback {
	readonly helper: ErasedHelper;
	readonly ordinal: number;
	readonly descriptor: unknown;
}

const comparePendingOrdinals = (
	left: PendingHelperRollback,
	right: PendingHelperRollback
): number => left.ordinal - right.ordinal;

const snapshotPendingRollback = (
	entry: PendingHelperRollback
): SerialJournalEntry => {
	const descriptor = entry.descriptor as {
		readonly key?: unknown;
		readonly label?: unknown;
		readonly run?: unknown;
	};
	const key = descriptor.key;
	const label = descriptor.label;
	const run = descriptor.run;
	return Object.freeze({
		ordinal: entry.ordinal,
		source: 'helper' as const,
		owner: entry.helper.attribution,
		rollbackKey: key,
		rollbackLabel: label,
		rollback: run,
	});
};

export const retainHelperRollback = (
	pending: PendingHelperRollback[],
	helper: ErasedHelper,
	ordinal: number,
	result: HelperApplyResult<unknown> | void
): void => {
	if (!result || typeof result !== 'object' || !('rollback' in result)) {
		return;
	}
	const rollback = result.rollback;
	if (!rollback) {
		return;
	}
	pending.push(
		Object.freeze({
			helper,
			ordinal,
			descriptor: rollback,
		})
	);
};

export const snapshotHelperRollbacks = (
	journal: SerialJournalEntry[],
	pending: PendingHelperRollback[]
): void => {
	const ordered = [...pending].sort(comparePendingOrdinals);
	const snapshots: SerialJournalEntry[] = [];
	for (const entry of ordered) {
		snapshots.push(snapshotPendingRollback(entry));
	}
	journal.push(...snapshots);
	pending.splice(0, pending.length);
};

export const snapshotSuccessfulHelperPhase = (
	journal: SerialJournalEntry[],
	pending: PendingHelperRollback[]
): void => {
	try {
		snapshotHelperRollbacks(journal, pending);
	} catch (error) {
		// The v1 stage failure path rebuilds the whole atomic segment once before
		// compensation. Preserve the first snapshot failure when that retry works.
		snapshotHelperRollbacks(journal, pending);
		throw error;
	}
};
