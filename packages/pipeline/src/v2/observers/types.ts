import type { MaybePromise } from '../graph/types.js';

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

/** Read-only event algebra exposed to passive run observers. */
export type RunEvent = NodeRunEvent | TerminalRunEvent;

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
	readonly publishTerminal: (
		outcomeKind: TerminalRunEvent['outcomeKind']
	) => undefined | Promise<void>;
	readonly failures: () => readonly RunObserverFailure[];
}
