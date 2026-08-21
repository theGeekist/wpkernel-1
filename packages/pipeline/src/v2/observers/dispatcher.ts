import { inspectDenseArray } from '../graph/inspection.js';
import { GraphSchedulerError } from '../scheduler/errors.js';
import { observeParticipant } from '../scheduler/maybe-promise.js';
import type {
	EffectRunEvent,
	NodeRunEvent,
	ObserverDispatcher,
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
		throw new GraphSchedulerError({
			code: 'invalid-observer',
			message: 'Run observers must be a dense array of functions.',
			cause,
		});
	}
};

/**
 * Compiles one immutable observer registration snapshot and FIFO dispatcher.
 *
 * @param options           - Observer compilation options.
 * @param options.observers - Immutable observer registration snapshot.
 */
export const compileRunObservers = (options: {
	readonly observers?: readonly RunObserver[];
}): ObserverDispatcher => {
	const observers = observerSnapshot(options.observers);
	const retainedFailures: RunObserverFailure[] = [];
	let tail: Promise<void> | undefined;
	let nextSequence = 0;

	const retainFailure = (failure: {
		readonly observerIndex: number;
		readonly eventSequence: number;
		readonly error: unknown;
	}): void => {
		retainedFailures.push(Object.freeze(failure));
	};

	const deliverFrom = (
		event: RunEvent,
		startIndex: number
	): void | Promise<void> => {
		let observerIndex = startIndex;
		while (observerIndex < observers.length) {
			const observer = observers[observerIndex]!;
			let returned: unknown;
			try {
				returned = Reflect.apply(observer, undefined, [event]);
			} catch (error) {
				retainFailure({
					observerIndex,
					eventSequence: event.sequence,
					error,
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
					observerIndex,
					eventSequence: event.sequence,
					error: observed.error,
				});
				observerIndex += 1;
				continue;
			}
			const resumeIndex = observerIndex + 1;
			return observed.promise.then(
				() => deliverFrom(event, resumeIndex),
				(error: unknown) => {
					retainFailure({
						observerIndex,
						eventSequence: event.sequence,
						error,
					});
					return deliverFrom(event, resumeIndex);
				}
			);
		}
		return undefined;
	};

	const enqueue = (event: RunEvent): void => {
		if (tail) {
			tail = tail.then(() => deliverFrom(event, 0));
			return;
		}
		const delivered = deliverFrom(event, 0);
		if (delivered instanceof Promise) {
			tail = delivered;
		}
	};

	const sequence = (): number => {
		const current = nextSequence;
		nextSequence += 1;
		return current;
	};

	return Object.freeze({
		publishNode({
			node,
			nodeOrdinal,
			state,
		}: {
			readonly node: string;
			readonly nodeOrdinal: number;
			readonly state: NodeRunEvent['state'];
		}) {
			enqueue(
				Object.freeze({
					kind: 'node-transition',
					sequence: sequence(),
					node,
					nodeOrdinal,
					state,
				})
			);
		},
		publishEffect({
			effect,
			phase,
			state,
		}: Parameters<ObserverDispatcher['publishEffect']>[0]) {
			enqueue(
				Object.freeze({
					kind: 'effect-transition',
					sequence: sequence(),
					node: effect.node,
					nodeOrdinal: effect.nodeOrdinal,
					effectOrdinal: effect.effectOrdinal,
					participant: String(effect.request.participant),
					phase,
					state,
				}) as EffectRunEvent
			);
		},
		publishTerminal(outcomeKind: TerminalRunEvent['outcomeKind']) {
			enqueue(
				Object.freeze({
					kind: 'run-terminal',
					sequence: sequence(),
					outcomeKind,
				})
			);
			return tail;
		},
		failures: () => Object.freeze([...retainedFailures]),
	});
};
