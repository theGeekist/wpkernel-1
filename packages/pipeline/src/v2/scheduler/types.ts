import type {
	Edge,
	EffectRegistry,
	EffectRequest,
	Graph,
	GraphOutputs,
	GraphValue,
	FailureOf,
	MaybePromise,
	NodeRegistry,
	OutputOf,
	OutputProjection,
	PauseRequest,
} from '../graph/types.js';
import type { GraphSchedulerError } from './errors.js';
import type {
	CheckedNodeMiddlewareRegistrations,
	NodeMiddlewareRegistration,
} from '../middleware/types.js';
import type { RunObserver, RunObserverFailure } from '../observers/types.js';
import type {
	EffectJournalEntry,
	EffectJournalFailure,
	EffectParticipants,
} from '../effects/types.js';
import type { RunDiagnostics } from '../diagnostics/types.js';
import type { Suspension } from '../suspension/types.js';

/** Scheduler-owned effect request in deterministic logical order. */
export interface PendingEffect<TEffects extends EffectRegistry> {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinal: number;
	readonly request: EffectRequest<TEffects>;
}

/**
 * Located diagnostic record of one admitted {@link PauseRequest}.
 * It contains no continuation authority.
 *
 * @public
 */
export interface PauseRecord {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly request: PauseRequest;
}

type NodeKeyOf<TNodes extends NodeRegistry> = keyof TNodes & string;

/**
 * A retained graph failure keyed to its exact declared node failure type.
 * The primary graph failure is selected by canonical node order, never by
 * settlement timing.
 *
 * @public
 */
export type GraphNodeFailure<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry = EffectRegistry,
> = {
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
		  }
		| {
				readonly kind: 'effect';
				readonly node: K;
				readonly nodeOrdinal: number;
				readonly error: EffectJournalFailure<TEffects>;
		  };
}[NodeKeyOf<TNodes>];

/**
 * Canonical terminal projection for one graph node.
 *
 * @public
 */
export type NodeOutcome<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry = EffectRegistry,
> = {
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
					GraphNodeFailure<TNodes, TEffects>,
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
	/** Node outcomes in compiled canonical graph order. */
	readonly nodes: readonly NodeOutcome<TNodes, TEffects>[];
	readonly pendingEffects: readonly PendingEffect<TEffects>[];
	readonly pendingPauses: readonly PauseRecord[];
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
				readonly primaryFailure: GraphNodeFailure<TNodes, TEffects>;
				readonly failures: readonly GraphNodeFailure<
					TNodes,
					TEffects
				>[];
		  }
		| {
				readonly kind: 'cancelled';
				readonly reason?: unknown;
		  }
		| {
				readonly kind: 'pause-requested';
				readonly primaryPause: PauseRecord;
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
	TParticipants extends Readonly<Record<PropertyKey, unknown>>,
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
	readonly inputs: NoInfer<TInputs>;
	readonly capabilities: NoInfer<TCapabilities>;
	readonly participants: TParticipants &
		EffectParticipants<TEffects> &
		Readonly<Record<Exclude<keyof TParticipants, keyof TEffects>, never>>;
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
	RunOutcome<TNodes, GraphOutputs<TNodes, TProjection>, TEffects>
>;

/** One failure retained by the complete graph and effect interpreter. @public */
export type RunFailure<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
> = GraphNodeFailure<TNodes, TEffects> | EffectJournalFailure<TEffects>;

interface RunProjection<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
> {
	readonly nodes: readonly NodeOutcome<TNodes, TEffects>[];
	readonly observerFailures: readonly RunObserverFailure[];
	readonly effectJournal: readonly EffectJournalEntry<TEffects>[];
	readonly effectFailures: readonly EffectJournalFailure<TEffects>[];
	readonly diagnostics: RunDiagnostics;
}

/**
 * Complete immutable process-local run outcome after graph scheduling and the
 * effect work appropriate to its variant.
 *
 * `nodes` is always in compiled canonical graph order. Successful runs commit
 * their prepared journal; failed and cancelled runs perform the applicable
 * reverse-journal compensation. A suspended run instead retains its prepared
 * entries for later resume or abandon: commit and compensation have not been
 * attempted for that suspension.
 *
 * Node failures are primary by canonical node order. Effect preparation or
 * commit failures retain their logical journal order; compensation and observer
 * failures are contained as evidence and do not replace the triggering error.
 * A suspended outcome carries a live single-use process-local capability, not
 * a serialisable checkpoint.
 *
 * @public
 */
export type RunOutcome<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = RunProjection<TNodes, TEffects> &
	(
		| { readonly kind: 'succeeded'; readonly outputs: TOutputs }
		| {
				readonly kind: 'failed';
				readonly primaryFailure: RunFailure<TNodes, TEffects>;
				readonly failures: readonly RunFailure<TNodes, TEffects>[];
		  }
		| { readonly kind: 'cancelled'; readonly reason?: unknown }
		| {
				readonly kind: 'suspended';
				readonly primaryPause: PauseRecord;
				readonly suspension: Suspension<TNodes, TOutputs, TEffects>;
		  }
	);
