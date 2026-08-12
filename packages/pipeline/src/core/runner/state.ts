/** Internal ownership key for transaction records carried through runner state. */
export const rollbackJournalState = Symbol('pipeline.rollback-journal');

const rollbackAppliedHalts = new WeakSet<object>();

export const markRollbackApplied = <THalt extends object>(
	halt: THalt
): THalt => {
	rollbackAppliedHalts.add(halt);
	return halt;
};

export const isRollbackApplied = (halt: object): boolean =>
	rollbackAppliedHalts.has(halt);
