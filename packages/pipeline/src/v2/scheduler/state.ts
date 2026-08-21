import type {
	EffectRegistry,
	ErasedGraph,
	GraphValue,
	NodeInvocation,
	NodeRegistry,
} from '../graph/types.js';
import type { CompiledNodeMiddleware } from '../middleware/types.js';
import type { ObserverDispatcher } from '../observers/types.js';
import type { EffectJournalRuntime } from '../effects/types.js';
import type {
	GraphNodeFailure,
	GraphScheduleOutcome,
	PendingEffect,
	PendingPause,
	RunOutcome,
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
	| {
			readonly kind: 'active';
			readonly admissionSequence: number;
	  }
	| {
			readonly kind: 'succeeded';
			readonly admissionSequence: number;
			readonly settlementSequence: number;
			readonly output: GraphValue;
			readonly effects: readonly PendingEffect<TEffects>[];
			readonly pause?: PendingPause;
	  }
	| {
			readonly kind: 'failed';
			readonly admissionSequence: number;
			readonly settlementSequence: number;
			readonly failureClass: 'graph' | 'cancel';
			readonly failure: GraphNodeFailure<NodeRegistry, TEffects>;
			readonly secondaryFailures: readonly GraphNodeFailure<
				NodeRegistry,
				TEffects
			>[];
			readonly effects: readonly PendingEffect<TEffects>[];
	  }
	| {
			readonly kind: 'cancelled';
			readonly admissionSequence: number;
			readonly settlementSequence: number;
			readonly reason?: unknown;
			readonly effects: readonly PendingEffect<TEffects>[];
	  };

export type ErasedScheduleOutcome<TEffects extends EffectRegistry> =
	GraphScheduleOutcome<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;

export type ErasedRunOutcome<TEffects extends EffectRegistry> = RunOutcome<
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
	readonly journal: EffectJournalRuntime<TEffects>;
	readonly nodes: Map<string, NodeRuntimeState<TEffects>>;
	readonly ready: OrdinalReadyQueue;
	active: number;
	nextAdmissionSequence: number;
	nextSettlementSequence: number;
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
