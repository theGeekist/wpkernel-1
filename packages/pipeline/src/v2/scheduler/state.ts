import type {
	EffectRegistry,
	ErasedGraph,
	GraphValue,
	NodeInvocation,
	NodeRegistry,
} from '../graph/types.js';
import type { CompiledNodeMiddleware } from '../middleware/types.js';
import type { ObserverDispatcher } from '../observers/types.js';
import type {
	GraphNodeFailure,
	GraphScheduleOutcome,
	PendingEffect,
	PendingPause,
} from './types.js';
import type { OrdinalReadyQueue } from './ready-queue.js';

export type ErasedExecutor = (
	options: NodeInvocation<
		Readonly<Record<string, GraphValue>>,
		Readonly<Record<string, GraphValue>>,
		unknown
	>
) => unknown;

export type NodeRuntimeState<TEffects extends EffectRegistry> =
	| {
			readonly kind: 'pending';
			readonly remainingPredecessors: number;
	  }
	| { readonly kind: 'active' }
	| {
			readonly kind: 'succeeded';
			readonly output: GraphValue;
			readonly effects: readonly PendingEffect<TEffects>[];
			readonly pause?: PendingPause;
	  }
	| {
			readonly kind: 'failed';
			readonly failureClass: 'graph' | 'cancel';
			readonly failure: GraphNodeFailure<NodeRegistry>;
			readonly secondaryFailures: readonly GraphNodeFailure<NodeRegistry>[];
			readonly effects: readonly PendingEffect<TEffects>[];
	  }
	| {
			readonly kind: 'cancelled';
			readonly reason?: unknown;
			readonly effects: readonly PendingEffect<TEffects>[];
	  };

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
	readonly middleware: CompiledNodeMiddleware;
	readonly observers: ObserverDispatcher;
	readonly nodes: Map<string, NodeRuntimeState<TEffects>>;
	readonly ready: OrdinalReadyQueue;
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
