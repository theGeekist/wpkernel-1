import type { EffectRegistry } from '../graph/types.js';
import { publishEffectEvent } from '../observers/dispatcher.js';
import { invokeParticipant } from '../scheduler/maybe-promise.js';
import type { PendingEffect } from '../scheduler/types.js';
import { ownEffectPhaseResult } from './ownership.js';
import type {
	CompiledEffectParticipants,
	EffectJournalEntry,
	EffectJournalFailure,
	EffectJournalRuntime,
	EffectPhase,
	EffectStepResult,
	JournalOwnedEntry,
} from './types.js';

const journalKey = <TEffects extends EffectRegistry>(
	effect: PendingEffect<TEffects>
): string => `${effect.nodeOrdinal}:${effect.effectOrdinal}`;

const failure = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly effect: PendingEffect<TEffects>;
	readonly phase: EffectPhase;
	readonly kind: 'declared' | 'thrown';
	readonly error: unknown;
}): EffectStepResult<TEffects> => {
	const retained = Object.freeze({
		participant: options.effect.request.participant,
		phase: options.phase,
		node: options.effect.node,
		nodeOrdinal: options.effect.nodeOrdinal,
		effectOrdinal: options.effect.effectOrdinal,
		kind: options.kind,
		error: options.error,
	}) as EffectJournalFailure<TEffects>;
	options.runtime.failures.push(retained);
	publishEffectEvent(options.runtime.observers, {
		effect: options.effect,
		phase: options.phase,
		state: 'failed',
	});
	return Object.freeze({ ok: false, failure: retained });
};

const retainPrepared = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly effect: PendingEffect<TEffects>;
	readonly prepared: unknown;
}): EffectStepResult<TEffects> => {
	options.runtime.entries.set(
		journalKey(options.effect),
		Object.freeze({
			effect: options.effect,
			prepared: options.prepared,
			receiptPresent: false,
			commit: 'not-attempted',
			compensation: 'not-attempted',
		})
	);
	publishEffectEvent(options.runtime.observers, {
		effect: options.effect,
		phase: 'prepare',
		state: 'succeeded',
	});
	return Object.freeze({ ok: true });
};

const settlePrepare = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly effect: PendingEffect<TEffects>;
	readonly value: unknown;
}): EffectStepResult<TEffects> => {
	const owned = ownEffectPhaseResult({
		value: options.value,
		participant: String(options.effect.request.participant),
		phase: 'prepare',
	});
	if (owned.kind === 'success') {
		return retainPrepared({ ...options, prepared: owned.value });
	}
	return failure({
		...options,
		phase: 'prepare',
		kind: owned.kind === 'declared' ? 'declared' : 'thrown',
		error: owned.error,
	});
};

export const createEffectJournalRuntime = <
	TEffects extends EffectRegistry,
>(options: {
	readonly participants: CompiledEffectParticipants;
	readonly observers: EffectJournalRuntime<TEffects>['observers'];
}): EffectJournalRuntime<TEffects> => ({
	participants: options.participants,
	observers: options.observers,
	entries: new Map(),
	failures: [],
	settlement: Object.freeze({ kind: 'idle' }),
});

/**
 * Prepares exactly one request through the shared MaybePromise boundary.
 *
 * @param options         - Preparation options.
 * @param options.runtime - Process-local journal runtime.
 * @param options.effect  - Immutable effect request identity.
 * @param options.signal  - Run cancellation signal.
 */
export const prepareEffect = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly effect: PendingEffect<TEffects>;
	readonly signal: AbortSignal;
}): EffectStepResult<TEffects> | Promise<EffectStepResult<TEffects>> => {
	const participant =
		options.runtime.participants[
			String(options.effect.request.participant)
		]!;
	const observed = invokeParticipant<unknown>(
		participant.prepare,
		Object.freeze({
			payload: options.effect.request.payload,
			signal: options.signal,
		})
	);
	if (observed.kind === 'synchronous') {
		return settlePrepare({ ...options, value: observed.value });
	}
	if (observed.kind === 'failed') {
		return failure({
			...options,
			phase: 'prepare',
			kind: 'thrown',
			error: observed.error,
		});
	}
	return observed.promise.then(
		(value) => settlePrepare({ ...options, value }),
		(error: unknown) =>
			failure({
				...options,
				phase: 'prepare',
				kind: 'thrown',
				error,
			})
	);
};

export const replaceJournalEntry = <TEffects extends EffectRegistry>(
	runtime: EffectJournalRuntime<TEffects>,
	entry: JournalOwnedEntry<TEffects>
): void => {
	runtime.entries.set(journalKey(entry.effect), Object.freeze(entry));
};

export const retainEffectFailure = failure;

export const orderedJournalEntries = <TEffects extends EffectRegistry>(
	runtime: EffectJournalRuntime<TEffects>
): readonly JournalOwnedEntry<TEffects>[] =>
	[...runtime.entries.values()].sort(
		(left, right) =>
			left.effect.nodeOrdinal - right.effect.nodeOrdinal ||
			left.effect.effectOrdinal - right.effect.effectOrdinal
	);

export const projectEffectJournal = <TEffects extends EffectRegistry>(
	runtime: EffectJournalRuntime<TEffects>
): readonly EffectJournalEntry<TEffects>[] =>
	Object.freeze(
		orderedJournalEntries(runtime).map((entry) =>
			Object.freeze({
				node: entry.effect.node,
				nodeOrdinal: entry.effect.nodeOrdinal,
				effectOrdinal: entry.effect.effectOrdinal,
				request: entry.effect.request,
				commit: entry.commit,
				compensation: entry.compensation,
			})
		)
	);

export const projectPreparedEffects = <TEffects extends EffectRegistry>(
	runtime: EffectJournalRuntime<TEffects>
): readonly PendingEffect<TEffects>[] =>
	Object.freeze(orderedJournalEntries(runtime).map((entry) => entry.effect));
