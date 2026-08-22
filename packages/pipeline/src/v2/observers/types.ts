import type { MaybePromise } from '../graph/types.js';
import type { EffectPhase } from '../effects/types.js';

/** Immutable diagnostic event emitted after one node state transition. @public */
export interface NodeRunEvent {
	readonly kind: 'node-transition';
	readonly sequence: number;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly state: 'active' | 'succeeded' | 'failed' | 'cancelled';
}

/** Immutable terminal diagnostic event queued after run finalisation. @public */
export interface TerminalRunEvent {
	readonly kind: 'run-terminal';
	readonly sequence: number;
	readonly outcomeKind:
		| 'succeeded'
		| 'failed'
		| 'cancelled'
		| 'suspended'
		| 'abandoned';
}

/** Immutable diagnostic event emitted after one effect phase transition. @public */
export interface EffectRunEvent {
	readonly kind: 'effect-transition';
	readonly sequence: number;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinal: number;
	readonly participant: string;
	readonly phase: EffectPhase;
	readonly state: 'succeeded' | 'failed';
}

/** Read-only event algebra exposed to passive run observers. @public */
export type RunEvent = NodeRunEvent | EffectRunEvent | TerminalRunEvent;

/**
 * Passive diagnostic consumer with no scheduler, data or effect authority.
 *
 * Events enter one FIFO delivery tail. Observer failures are contained and
 * retained; an observer thenable may promote terminal settlement, but it cannot
 * change the run result.
 *
 * @public
 */
export type RunObserver = (event: RunEvent) => MaybePromise<void>;

/** Contained observer failure retained without changing the run result. @public */
export interface RunObserverFailure {
	readonly observerIndex: number;
	readonly eventSequence: number;
	readonly error: unknown;
}

/** Explicit mutable process-local observer delivery state. @internal */
export interface ObserverRuntime {
	readonly observers: readonly RunObserver[];
	readonly failures: RunObserverFailure[];
	readonly events: RunEvent[];
	tail?: Promise<void>;
	nextSequence: number;
}

/** @internal */
export interface ObserverNodeTransition {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly state: NodeRunEvent['state'];
}

/** @internal */
export interface ObserverEffectTransition {
	readonly effect: {
		readonly node: string;
		readonly nodeOrdinal: number;
		readonly effectOrdinal: number;
		readonly request: { readonly participant: PropertyKey };
	};
	readonly phase: EffectPhase;
	readonly state: EffectRunEvent['state'];
}
