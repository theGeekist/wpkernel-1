import { getGraphExecutor } from '../graph/executors.js';
import type {
	Edge,
	EffectRegistry,
	ErasedGraph,
	GraphValue,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';
import { compileNodeMiddleware } from '../middleware/compile.js';
import type { NodeMiddlewareRegistration } from '../middleware/types.js';
import { createObserverRuntime } from '../observers/dispatcher.js';
import {
	compileEffectParticipants,
	createEffectJournalRuntime,
} from '../effects/index.js';
import { executeSchedulerState } from '../suspension/runtime.js';
import { createGraphSchedulerError } from './errors.js';
import { ownGraphInputs, validateOwnedGraphInputs } from './ownership.js';
import { addReadyNode, createReadyQueue } from './ready-queue.js';
import type { ErasedExecutor, SchedulerState } from './state.js';
import type { ScheduleGraphOptions, ScheduleGraphResult } from './types.js';

const executorTable = (
	graph: ErasedGraph
): ReadonlyMap<string, ErasedExecutor> => {
	const executors = new Map<string, ErasedExecutor>();
	for (const node of Object.values(graph.nodes)) {
		const executor = getGraphExecutor({ graph, key: node.key });
		if (typeof executor !== 'function') {
			throw createGraphSchedulerError({
				code: 'invalid-graph',
				message: `Compiled graph executor "${node.key}" is unavailable.`,
			});
		}
		executors.set(node.key, executor as ErasedExecutor);
	}
	return executors;
};

const createState = <TEffects extends EffectRegistry>(options: {
	readonly graph: ErasedGraph;
	readonly inputs: Readonly<Record<string, GraphValue>>;
	readonly capabilities: unknown;
	readonly signal: AbortSignal;
	readonly executors: ReadonlyMap<string, ErasedExecutor>;
	readonly middleware: SchedulerState<TEffects>['middleware'];
	readonly observers: SchedulerState<TEffects>['observers'];
	readonly journal: SchedulerState<TEffects>['journal'];
}): SchedulerState<TEffects> => {
	const nodes = new Map<
		string,
		Readonly<{ kind: 'pending'; remainingPredecessors: number }>
	>();
	const ready = createReadyQueue(options.graph.ordinals);
	for (const node of Object.values(options.graph.nodes).sort(
		(left, right) => left.ordinal - right.ordinal
	)) {
		const remaining = options.graph.incoming[node.key]!.length;
		nodes.set(
			node.key,
			Object.freeze({
				kind: 'pending',
				remainingPredecessors: remaining,
			})
		);
		if (remaining === 0) {
			addReadyNode(ready, node.key);
		}
	}
	return {
		graph: options.graph,
		inputs: options.inputs,
		capabilities: options.capabilities,
		signal: options.signal,
		executors: options.executors,
		middleware: options.middleware,
		observers: options.observers,
		journal: options.journal,
		nodes,
		ready,
		active: 0,
		nextAdmissionSequence: 0,
		nextSettlementSequence: 0,
		admissionStopped: false,
		terminal: false,
	};
};

/**
 * Schedules one compiled immutable graph directly from dependency readiness.
 * Executor, middleware and prepare thenables promote node evaluation. Commit
 * and compensation thenables promote journal settlement. Observer thenables
 * never gate work and may promote only terminal delivery.
 *
 * @param options - Compiled graph, admitted inputs, capabilities and signal.
 */
export const scheduleGraph = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	const TParticipants extends Readonly<Record<PropertyKey, unknown>>,
	const TMiddleware extends readonly NodeMiddlewareRegistration[],
>(
	options: ScheduleGraphOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities,
		TParticipants,
		TMiddleware
	>
): ScheduleGraphResult<TNodes, TEffects, TProjection> => {
	const graph = options.graph as unknown as ErasedGraph;
	const inputs = ownGraphInputs({
		value: options.inputs,
		inputKeys: graph.inputKeys,
	});
	return executeOwnedGraph({ ...options, graph, inputs });
};

const executeOwnedGraph = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
>(options: {
	readonly graph: ErasedGraph;
	readonly inputs: Readonly<Record<string, GraphValue>>;
	readonly capabilities: unknown;
	readonly participants: unknown;
	readonly signal?: AbortSignal;
	readonly middleware?: readonly NodeMiddlewareRegistration[];
	readonly observers?: Parameters<
		typeof createObserverRuntime
	>[0]['observers'];
}): ScheduleGraphResult<TNodes, TEffects, TProjection> => {
	const signal = options.signal ?? new AbortController().signal;
	const observers = createObserverRuntime({ observers: options.observers });
	const executors = executorTable(options.graph);
	const participants = compileEffectParticipants({
		graph: options.graph,
		participants: options.participants,
	});
	const state = createState<TEffects>({
		graph: options.graph,
		inputs: options.inputs,
		capabilities: options.capabilities,
		signal,
		executors,
		middleware: compileNodeMiddleware({
			graph: options.graph,
			middleware: options.middleware,
		}),
		observers,
		journal: createEffectJournalRuntime({ participants, observers }),
	});
	const complete = executeSchedulerState(state);
	return complete as ScheduleGraphResult<TNodes, TEffects, TProjection>;
};

/**
 * Scheduler entry for an already-owned Pipeline input snapshot.
 *
 * @param options - Complete scheduler input with an owned graph-input record.
 * @internal
 */
export const scheduleOwnedGraph = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
>(
	options: Parameters<
		typeof executeOwnedGraph<TNodes, TEffects, TProjection>
	>[0]
): ScheduleGraphResult<TNodes, TEffects, TProjection> => {
	const invalid = validateOwnedGraphInputs({
		value: options.inputs,
		inputKeys: options.graph.inputKeys,
	});
	if (invalid) {
		throw invalid;
	}
	return executeOwnedGraph(options);
};
