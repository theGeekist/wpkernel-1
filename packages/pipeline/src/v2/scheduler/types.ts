import type {
	Edge,
	EffectRegistry,
	EffectRequestFor,
	Graph,
	GraphOutputs,
	GraphValue,
	FailureOf,
	MaybePromise,
	NodeRegistry,
	OutputOf,
	OutputProjection,
} from '../graph/types.js';
import type { GraphSchedulerError } from './errors.js';
import type {
	CheckedNodeMiddlewareRegistrations,
	NodeMiddlewareRegistration,
} from '../middleware/types.js';
import type { RunObserver, RunObserverFailure } from '../observers/types.js';

/** One immutable effect request awaiting the P2-005 effect interpreter. */
export type PendingEffectRequest<TEffects extends EffectRegistry> = {
	readonly [K in keyof TEffects]: EffectRequestFor<TEffects, K>;
}[keyof TEffects];

/** Scheduler-owned effect request in deterministic logical order. */
export interface PendingEffect<TEffects extends EffectRegistry> {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinal: number;
	readonly request: PendingEffectRequest<TEffects>;
}

/** A clean node pause request awaiting the P2-006 suspension interpreter. */
export interface PendingPause {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly request: Readonly<{ readonly reason?: string }>;
}

type NodeKeyOf<TNodes extends NodeRegistry> = keyof TNodes & string;

/** A retained graph failure keyed to its exact declared node failure type. */
export type GraphNodeFailure<TNodes extends NodeRegistry> = {
	readonly [K in NodeKeyOf<TNodes>]:
		| {
				readonly kind: 'declared';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly error: FailureOf<TNodes[K]>;
		  }
		| {
				readonly kind: 'thrown';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly error: unknown;
		  }
		| {
				readonly kind: 'contract';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly error: GraphSchedulerError;
		  };
}[NodeKeyOf<TNodes>];

/** Canonical terminal projection for one graph node. */
export type ScheduledNodeOutcome<TNodes extends NodeRegistry> = {
	readonly [K in NodeKeyOf<TNodes>]:
		| {
				readonly kind: 'succeeded';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly output: OutputOf<TNodes[K]>;
		  }
		| {
				readonly kind: 'failed';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly failure: Extract<
					GraphNodeFailure<TNodes>,
					{ readonly node: K }
				>;
		  }
		| {
				readonly kind: 'cancelled';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly reason?: unknown;
		  }
		| {
				readonly kind: 'blocked';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly reason: 'dependency' | 'admission-stopped';
				readonly blockedBy: readonly NodeKeyOf<TNodes>[];
		  };
}[NodeKeyOf<TNodes>];

interface GraphScheduleProjection<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
> {
	readonly nodes: readonly ScheduledNodeOutcome<TNodes>[];
	readonly pendingEffects: readonly PendingEffect<TEffects>[];
	readonly pendingPauses: readonly PendingPause[];
	readonly observerFailures: readonly RunObserverFailure[];
}

/** Terminal immutable result of graph scheduling before effect interpretation. */
export type GraphScheduleOutcome<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = GraphScheduleProjection<TNodes, TEffects> &
	(
		| {
				readonly kind: 'succeeded';
				readonly outputs: TOutputs;
		  }
		| {
				readonly kind: 'failed';
				readonly primaryFailure: GraphNodeFailure<TNodes>;
				readonly failures: readonly GraphNodeFailure<TNodes>[];
		  }
		| {
				readonly kind: 'cancelled';
				readonly reason?: unknown;
		  }
		| {
				readonly kind: 'pause-requested';
				readonly primaryPause: PendingPause;
		  }
	);

/** Complete immutable input to one graph scheduling run. */
export interface ScheduleGraphOptions<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	TMiddleware extends
		readonly NodeMiddlewareRegistration[] = readonly NodeMiddlewareRegistration[],
> {
	readonly graph: Graph<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
	readonly inputs: TInputs;
	readonly capabilities: TCapabilities;
	readonly signal?: AbortSignal;
	readonly middleware?: TMiddleware &
		CheckedNodeMiddlewareRegistrations<
			TInputs,
			TNodes,
			TEdges,
			TEffects,
			TCapabilities,
			NoInfer<TMiddleware>
		>;
	readonly observers?: readonly RunObserver[];
}

/** Exact inferred result of {@link scheduleGraph}. */
export type ScheduleGraphResult<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
> = MaybePromise<
	GraphScheduleOutcome<TNodes, GraphOutputs<TNodes, TProjection>, TEffects>
>;
