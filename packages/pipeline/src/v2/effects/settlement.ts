import type { EffectRegistry } from '../graph/types.js';
import { invokeParticipant } from '../scheduler/maybe-promise.js';
import { ownEffectPhaseResult } from './ownership.js';
import {
	orderedJournalEntries,
	replaceJournalEntry,
	retainEffectFailure,
} from './runtime.js';
import type {
	ActiveJournalSettlement,
	EffectJournalFailure,
	EffectJournalRuntime,
	EffectStepResult,
	JournalSettlement,
	JournalOwnedEntry,
} from './types.js';

export type { JournalSettlement } from './types.js';

interface SettlementState<TEffects extends EffectRegistry> {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly signal: AbortSignal;
	readonly entries: JournalOwnedEntry<TEffects>[];
	readonly authority: ActiveJournalSettlement<TEffects>;
	phase: 'commit' | 'compensate';
	cursor: number;
	trigger: 'graph' | 'cancel' | 'commit' | 'abandon';
	triggerFailure?: EffectJournalFailure<TEffects>;
}

const phaseFailure = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly phase: 'commit' | 'compensate';
	readonly kind: 'declared' | 'thrown';
	readonly error: unknown;
}): EffectStepResult<TEffects> =>
	retainEffectFailure({
		runtime: options.state.runtime,
		effect: options.entry.effect,
		phase: options.phase,
		kind: options.kind,
		error: options.error,
	});

const ownSettlementResult = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly phase: 'commit' | 'compensate';
	readonly value: unknown;
}): EffectStepResult<TEffects> & { readonly value?: unknown } => {
	const owned = ownEffectPhaseResult({
		value: options.value,
		participant: String(options.entry.effect.request.participant),
		phase: options.phase,
	});
	if (owned.kind !== 'success') {
		return phaseFailure({
			...options,
			kind: owned.kind === 'declared' ? 'declared' : 'thrown',
			error: owned.error,
		});
	}
	if (options.phase === 'compensate' && owned.value !== undefined) {
		const invalid = ownEffectPhaseResult({
			value: { kind: 'success' },
			participant: String(options.entry.effect.request.participant),
			phase: options.phase,
		}) as Extract<
			ReturnType<typeof ownEffectPhaseResult>,
			{ readonly kind: 'contract' }
		>;
		return phaseFailure({
			...options,
			kind: 'thrown',
			error: invalid.error,
		});
	}
	return Object.freeze({ ok: true, value: owned.value });
};

const finishSettlementPhase = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly phase: 'commit' | 'compensate';
	readonly value: unknown;
}): EffectStepResult<TEffects> & { readonly value?: unknown } => {
	const result = ownSettlementResult(options);
	options.state.authority.phase = undefined;
	return result;
};

const failSettlementPhase = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly phase: 'commit' | 'compensate';
	readonly error: unknown;
}): EffectStepResult<TEffects> => {
	const result = phaseFailure({
		...options,
		kind: 'thrown',
	});
	options.state.authority.phase = undefined;
	return result;
};

const invokeSettlementPhase = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly phase: 'commit' | 'compensate';
}):
	| (EffectStepResult<TEffects> & { readonly value?: unknown })
	| Promise<EffectStepResult<TEffects> & { readonly value?: unknown }> => {
	const participant =
		options.state.runtime.participants[
			String(options.entry.effect.request.participant)
		]!;
	const phaseOptions =
		options.phase === 'commit'
			? Object.freeze({
					prepared: options.entry.prepared,
					signal: options.state.signal,
				})
			: Object.freeze({
					prepared: options.entry.prepared,
					...(options.entry.receiptPresent
						? { receipt: options.entry.receipt }
						: {}),
				});
	options.state.authority.phase = Object.freeze({
		kind: options.phase,
		nodeOrdinal: options.entry.effect.nodeOrdinal,
		effectOrdinal: options.entry.effect.effectOrdinal,
	});
	const observed = invokeParticipant<unknown>(
		participant[options.phase],
		phaseOptions
	);
	if (observed.kind === 'synchronous') {
		return finishSettlementPhase({ ...options, value: observed.value });
	}
	if (observed.kind === 'failed') {
		return failSettlementPhase({ ...options, error: observed.error });
	}
	return observed.promise.then(
		(value) => finishSettlementPhase({ ...options, value }),
		(error: unknown) => failSettlementPhase({ ...options, error })
	);
};

const markCommit = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly result: EffectStepResult<TEffects> & { readonly value?: unknown };
}): void => {
	const succeeded = options.result.ok;
	const updated: JournalOwnedEntry<TEffects> = Object.freeze({
		...options.entry,
		...(succeeded
			? { receiptPresent: true, receipt: options.result.value }
			: {}),
		commit: succeeded ? 'succeeded' : 'failed',
	});
	replaceJournalEntry(options.state.runtime, updated);
	options.state.entries[options.state.cursor] = updated;
	if (succeeded) {
		options.state.runtime.observers.publishEffect({
			effect: options.entry.effect,
			phase: 'commit',
			state: 'succeeded',
		});
		return;
	}
	options.state.phase = 'compensate';
	options.state.cursor = options.state.entries.length - 1;
	options.state.trigger = 'commit';
	options.state.triggerFailure = options.result.failure;
};

const markCompensation = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly result: EffectStepResult<TEffects>;
}): void => {
	const updated: JournalOwnedEntry<TEffects> = Object.freeze({
		...options.entry,
		compensation: options.result.ok ? 'succeeded' : 'failed',
	});
	replaceJournalEntry(options.state.runtime, updated);
	options.state.entries[options.state.cursor] = updated;
	if (options.result.ok) {
		options.state.runtime.observers.publishEffect({
			effect: options.entry.effect,
			phase: 'compensate',
			state: 'succeeded',
		});
	}
};

const completeSettlement = <TEffects extends EffectRegistry>(
	state: SettlementState<TEffects>
): JournalSettlement<TEffects> =>
	state.phase === 'commit'
		? Object.freeze({ kind: 'committed' })
		: Object.freeze({
				kind: 'compensated',
				trigger: state.trigger,
				...(state.triggerFailure
					? { triggerFailure: state.triggerFailure }
					: {}),
			});

const continueSettlement = <TEffects extends EffectRegistry>(options: {
	readonly state: SettlementState<TEffects>;
	readonly entry: JournalOwnedEntry<TEffects>;
	readonly result: EffectStepResult<TEffects> & { readonly value?: unknown };
}): JournalSettlement<TEffects> | Promise<JournalSettlement<TEffects>> => {
	if (options.state.phase === 'commit') {
		markCommit(options);
		if (options.state.phase === 'commit') {
			options.state.cursor += 1;
		}
	} else {
		markCompensation(options);
		options.state.cursor -= 1;
	}
	return driveSettlement(options.state);
};

type SettlementAdvance<TEffects extends EffectRegistry> =
	| JournalSettlement<TEffects>
	| Promise<JournalSettlement<TEffects>>
	| undefined;

const advanceCommit = <TEffects extends EffectRegistry>(
	state: SettlementState<TEffects>
): SettlementAdvance<TEffects> => {
	if (state.signal.aborted) {
		state.phase = 'compensate';
		state.cursor = state.entries.length - 1;
		state.trigger = 'cancel';
		return undefined;
	}
	if (state.cursor >= state.entries.length) {
		return completeSettlement(state);
	}
	const entry = state.entries[state.cursor]!;
	const invoked = invokeSettlementPhase({
		state,
		entry,
		phase: 'commit',
	});
	if (invoked instanceof Promise) {
		return invoked.then((result) =>
			continueSettlement({ state, entry, result })
		);
	}
	markCommit({ state, entry, result: invoked });
	if (state.phase === 'commit') {
		state.cursor += 1;
	}
	return undefined;
};

const advanceCompensation = <TEffects extends EffectRegistry>(
	state: SettlementState<TEffects>
): SettlementAdvance<TEffects> => {
	if (state.cursor < 0) {
		return completeSettlement(state);
	}
	const entry = state.entries[state.cursor]!;
	const invoked = invokeSettlementPhase({
		state,
		entry,
		phase: 'compensate',
	});
	if (invoked instanceof Promise) {
		return invoked.then((result) =>
			continueSettlement({ state, entry, result })
		);
	}
	markCompensation({ state, entry, result: invoked });
	state.cursor -= 1;
	return undefined;
};

const driveSettlement = <TEffects extends EffectRegistry>(
	state: SettlementState<TEffects>
): JournalSettlement<TEffects> | Promise<JournalSettlement<TEffects>> => {
	while (true) {
		const advanced =
			state.phase === 'commit'
				? advanceCommit(state)
				: advanceCompensation(state);
		if (advanced) {
			return advanced;
		}
	}
};

const joinActiveSettlement = <TEffects extends EffectRegistry>(
	authority: ActiveJournalSettlement<TEffects>
): Promise<JournalSettlement<TEffects>> => {
	if (authority.promise) {
		return authority.promise;
	}
	if (authority.join) {
		return authority.join.promise;
	}
	let resolve!: (settlement: JournalSettlement<TEffects>) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<JournalSettlement<TEffects>>(
		(onResolve, onReject) => {
			resolve = onResolve;
			reject = onReject;
		}
	);
	authority.join = { promise, resolve, reject };
	return promise;
};

const completeAuthority = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly authority: ActiveJournalSettlement<TEffects>;
	readonly settlement: JournalSettlement<TEffects>;
}): JournalSettlement<TEffects> => {
	options.authority.phase = undefined;
	options.runtime.settlement = Object.freeze({
		kind: 'settled',
		settlement: options.settlement,
	});
	options.authority.join?.resolve(options.settlement);
	return options.settlement;
};

const failAuthority = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly authority: ActiveJournalSettlement<TEffects>;
	readonly error: unknown;
}): never => {
	options.authority.phase = undefined;
	options.runtime.settlement = Object.freeze({
		kind: 'failed',
		error: options.error,
	});
	options.authority.join?.reject(options.error);
	throw options.error;
};

const settleJournal = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly signal: AbortSignal;
	readonly intent: 'commit' | 'compensate';
	readonly trigger: 'graph' | 'cancel' | 'abandon';
}): JournalSettlement<TEffects> | Promise<JournalSettlement<TEffects>> => {
	const retained = options.runtime.settlement;
	if (retained.kind === 'settled') {
		return retained.settlement;
	}
	if (retained.kind === 'failed') {
		throw retained.error;
	}
	if (retained.kind === 'active') {
		return joinActiveSettlement(retained);
	}
	const authority: ActiveJournalSettlement<TEffects> = {
		kind: 'active',
		intent: options.intent,
	};
	options.runtime.settlement = authority;
	const entries = [...orderedJournalEntries(options.runtime)];
	const compensate =
		options.intent === 'compensate' || options.signal.aborted;
	let driven:
		| JournalSettlement<TEffects>
		| Promise<JournalSettlement<TEffects>>;
	try {
		driven = driveSettlement({
			runtime: options.runtime,
			signal: options.signal,
			entries,
			authority,
			phase: compensate ? 'compensate' : 'commit',
			cursor: compensate ? entries.length - 1 : 0,
			trigger: options.signal.aborted ? 'cancel' : options.trigger,
		});
	} catch (error) {
		return failAuthority({ runtime: options.runtime, authority, error });
	}
	if (driven instanceof Promise) {
		const promise = driven.then(
			(settlement) =>
				completeAuthority({
					runtime: options.runtime,
					authority,
					settlement,
				}),
			(error: unknown) =>
				failAuthority({ runtime: options.runtime, authority, error })
		);
		authority.promise = promise;
		return promise;
	}
	return completeAuthority({
		runtime: options.runtime,
		authority,
		settlement: driven,
	});
};

export const commitEffectJournal = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly signal: AbortSignal;
}): JournalSettlement<TEffects> | Promise<JournalSettlement<TEffects>> =>
	settleJournal({ ...options, intent: 'commit', trigger: 'graph' });

export const compensateEffectJournal = <
	TEffects extends EffectRegistry,
>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly signal: AbortSignal;
	readonly trigger: 'graph' | 'cancel' | 'abandon';
}): JournalSettlement<TEffects> | Promise<JournalSettlement<TEffects>> =>
	settleJournal({ ...options, intent: 'compensate' });
