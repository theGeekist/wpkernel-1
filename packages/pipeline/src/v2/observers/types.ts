import type { MaybePromise } from '../graph/types.js';
import type { EffectPhase } from '../effects/types.js';

/** Immutable diagnostic event emitted after one node state transition. */
export interface NodeRunEvent {
	readonly kind: 'node-transition';
	readonly sequence: number;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly state: 'active' | 'succeeded' | 'failed' | 'cancelled';
}

/** Immutable terminal diagnostic event queued after graph finalisation. */
export interface TerminalRunEvent {
	readonly kind: 'run-terminal';
	readonly sequence: number;
	readonly outcomeKind:
		| 'succeeded'
		| 'failed'
		| 'cancelled'
		| 'pause-requested';
}

/** Immutable diagnostic event emitted after one effect phase transition. */
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

/** Read-only event algebra exposed to passive run observers. */
export type RunEvent = NodeRunEvent | EffectRunEvent | TerminalRunEvent;

/** Passive diagnostic consumer with no scheduler or graph authority. */
export type RunObserver = (event: RunEvent) => MaybePromise<void>;

/** Contained observer failure retained without changing the run result. */
export interface RunObserverFailure {
	readonly observerIndex: number;
	readonly eventSequence: number;
	readonly error: unknown;
}

/** @internal */
export interface ObserverDispatcher {
	readonly publishNode: (options: {
		readonly node: string;
		readonly nodeOrdinal: number;
		readonly state: NodeRunEvent['state'];
	}) => void;
	readonly publishEffect: (options: {
		readonly effect: {
			readonly node: string;
			readonly nodeOrdinal: number;
			readonly effectOrdinal: number;
			readonly request: { readonly participant: PropertyKey };
		};
		readonly phase: EffectPhase;
		readonly state: EffectRunEvent['state'];
	}) => void;
	readonly publishTerminal: (
		outcomeKind: TerminalRunEvent['outcomeKind']
	) => undefined | Promise<void>;
	readonly failures: () => readonly RunObserverFailure[];
}
