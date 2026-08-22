import { inspectDenseArray } from '../graph/inspection.js';
import { createGraphSchedulerError } from '../scheduler/errors.js';
import { observeParticipant } from '../scheduler/maybe-promise.js';
import type {
	EffectRunEvent,
	ObserverEffectTransition,
	ObserverNodeTransition,
	ObserverRuntime,
	RunEvent,
	RunObserver,
	RunObserverFailure,
	TerminalRunEvent,
} from './types.js';

const observerSnapshot = (value: unknown): readonly RunObserver[] => {
	if (value === undefined) {
		return Object.freeze([]);
	}
	try {
		const inspected = inspectDenseArray(value);
		if (
			!inspected.ok ||
			inspected.value.some((item) => typeof item !== 'function')
		) {
			throw new Error(
				inspected.ok
					? 'Every observer must be callable.'
					: inspected.reason
			);
		}
		return Object.freeze([...inspected.value]) as readonly RunObserver[];
	} catch (cause) {
		throw createGraphSchedulerError({
			code: 'invalid-observer',
			message: 'Run observers must be a dense array of functions.',
			cause,
		});
	}
};

/**
 * Creates explicit process-local state for one observer registration snapshot.
 *
 * @param options           - Observer compilation options.
 * @param options.observers - Immutable observer registration snapshot.
 */
export const createObserverRuntime = (options: {
	readonly observers?: readonly RunObserver[];
}): ObserverRuntime => ({
	observers: observerSnapshot(options.observers),
	failures: [],
	events: [],
	nextSequence: 0,
});

const retainFailure = (options: {
	readonly runtime: ObserverRuntime;
	readonly failure: {
		readonly observerIndex: number;
		readonly eventSequence: number;
		readonly error: unknown;
	};
}): void => {
	options.runtime.failures.push(Object.freeze(options.failure));
};

const retainTail = (runtime: ObserverRuntime, pending: Promise<void>): void => {
	runtime.tail = pending;
	const clearIfCurrent = (): void => {
		if (runtime.tail === pending) {
			runtime.tail = undefined;
		}
	};
	void pending.then(clearIfCurrent, clearIfCurrent);
};

const deliverFrom = (
	runtime: ObserverRuntime,
	event: RunEvent,
	startIndex: number
): void | Promise<void> => {
	let observerIndex = startIndex;
	while (observerIndex < runtime.observers.length) {
		const observer = runtime.observers[observerIndex]!;
		let returned: unknown;
		try {
			returned = Reflect.apply(observer, undefined, [event]);
		} catch (error) {
			retainFailure({
				runtime,
				failure: {
					observerIndex,
					eventSequence: event.sequence,
					error,
				},
			});
			observerIndex += 1;
			continue;
		}
		const observed = observeParticipant<void>(returned);
		if (observed.kind === 'synchronous') {
			observerIndex += 1;
			continue;
		}
		if (observed.kind === 'failed') {
			retainFailure({
				runtime,
				failure: {
					observerIndex,
					eventSequence: event.sequence,
					error: observed.error,
				},
			});
			observerIndex += 1;
			continue;
		}
		const resumeIndex = observerIndex + 1;
		return observed.promise.then(
			() => deliverFrom(runtime, event, resumeIndex),
			(error: unknown) => {
				retainFailure({
					runtime,
					failure: {
						observerIndex,
						eventSequence: event.sequence,
						error,
					},
				});
				return deliverFrom(runtime, event, resumeIndex);
			}
		);
	}
	return undefined;
};

const enqueue = (runtime: ObserverRuntime, event: RunEvent): void => {
	runtime.events.push(event);
	if (runtime.tail) {
		retainTail(
			runtime,
			runtime.tail.then(() => deliverFrom(runtime, event, 0))
		);
		return;
	}
	const delivered = deliverFrom(runtime, event, 0);
	if (delivered instanceof Promise) {
		retainTail(runtime, delivered);
	}
};

const takeSequence = (runtime: ObserverRuntime): number => {
	const current = runtime.nextSequence;
	runtime.nextSequence += 1;
	return current;
};

export const publishNodeEvent = (
	runtime: ObserverRuntime,
	options: ObserverNodeTransition
): void => {
	enqueue(
		runtime,
		Object.freeze({
			kind: 'node-transition',
			sequence: takeSequence(runtime),
			...options,
		})
	);
};

export const publishEffectEvent = (
	runtime: ObserverRuntime,
	options: ObserverEffectTransition
): void => {
	enqueue(
		runtime,
		Object.freeze({
			kind: 'effect-transition',
			sequence: takeSequence(runtime),
			node: options.effect.node,
			nodeOrdinal: options.effect.nodeOrdinal,
			effectOrdinal: options.effect.effectOrdinal,
			participant: String(options.effect.request.participant),
			phase: options.phase,
			state: options.state,
		}) as EffectRunEvent
	);
};

export const publishTerminalEvent = (
	runtime: ObserverRuntime,
	outcomeKind: TerminalRunEvent['outcomeKind']
): undefined | Promise<void> => {
	enqueue(
		runtime,
		Object.freeze({
			kind: 'run-terminal',
			sequence: takeSequence(runtime),
			outcomeKind,
		})
	);
	return runtime.tail;
};

export const projectObserverFailures = (
	runtime: ObserverRuntime
): readonly RunObserverFailure[] => Object.freeze([...runtime.failures]);

export const projectRunEvents = (
	runtime: ObserverRuntime
): readonly RunEvent[] => Object.freeze([...runtime.events]);
