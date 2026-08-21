import type {
	EffectRegistry,
	ErasedGraph,
	GraphValue,
	NodeInvocation,
	NodeRegistry,
} from '../graph/types.js';
import type {
	GraphNodeFailure,
	GraphScheduleOutcome,
	PendingEffect,
	PendingPause,
	ScheduledNodeOutcome,
} from './types.js';
import type { OrdinalReadyQueue } from './ready-queue.js';

export type ErasedExecutor = (
	options: NodeInvocation<
		Readonly<Record<string, GraphValue>>,
		Readonly<Record<string, GraphValue>>,
		unknown
	>
) => unknown;

export type NodeStatus =
	| 'pending'
	| 'active'
	| 'succeeded'
	| 'failed'
	| 'cancelled';

export type ErasedScheduleOutcome<TEffects extends EffectRegistry> =
	GraphScheduleOutcome<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;

export interface SchedulerCompletion<TEffects extends EffectRegistry> {
	readonly promise: Promise<ErasedScheduleOutcome<TEffects>>;
	readonly resolve: (outcome: ErasedScheduleOutcome<TEffects>) => void;
	readonly reject: (error: unknown) => void;
}

export interface SchedulerState<TEffects extends EffectRegistry> {
	readonly graph: ErasedGraph;
	readonly inputs: Readonly<Record<string, GraphValue>>;
	readonly capabilities: unknown;
	readonly signal: AbortSignal;
	readonly executors: ReadonlyMap<string, ErasedExecutor>;
	readonly status: Map<string, NodeStatus>;
	readonly remainingPredecessors: Map<string, number>;
	readonly ready: OrdinalReadyQueue;
	readonly outputs: Map<string, GraphValue>;
	readonly outcomes: Map<string, ScheduledNodeOutcome<NodeRegistry>>;
	readonly failures: Map<string, GraphNodeFailure<NodeRegistry>>;
	readonly effects: Map<string, readonly PendingEffect<TEffects>[]>;
	readonly pauses: Map<string, PendingPause>;
	active: number;
	admissionStopped: boolean;
	terminal: boolean;
	completion?: SchedulerCompletion<TEffects>;
	abortListener?: () => void;
}

export const createCompletion = <
	TEffects extends EffectRegistry,
>(): SchedulerCompletion<TEffects> => {
	let resolve!: (outcome: ErasedScheduleOutcome<TEffects>) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<ErasedScheduleOutcome<TEffects>>(
		(complete, fail) => {
			resolve = complete;
			reject = fail;
		}
	);
	return { promise, resolve, reject };
};
