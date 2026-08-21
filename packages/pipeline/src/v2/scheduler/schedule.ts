import { getGraphExecutor } from '../graph/executors.js';
import type {
	Edge,
	EffectRegistry,
	ErasedGraph,
	GraphValue,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';
import { driveScheduler, listenForAbort } from './engine.js';
import { GraphSchedulerError } from './errors.js';
import { ownGraphInputs } from './ownership.js';
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
			throw new GraphSchedulerError({
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
}): SchedulerState<TEffects> => {
	const status = new Map<string, 'pending'>();
	const remainingPredecessors = new Map<string, number>();
	const ready = createReadyQueue(options.graph.ordinals);
	for (const node of Object.values(options.graph.nodes).sort(
		(left, right) => left.ordinal - right.ordinal
	)) {
		status.set(node.key, 'pending');
		const remaining = options.graph.incoming[node.key]!.length;
		remainingPredecessors.set(node.key, remaining);
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
		status,
		remainingPredecessors,
		ready,
		outputs: new Map(),
		outcomes: new Map(),
		failures: new Map(),
		effects: new Map(),
		pauses: new Map(),
		active: 0,
		admissionStopped: false,
		terminal: false,
	};
};

/**
 * Schedules one compiled immutable graph directly from dependency readiness.
 * The return remains synchronous until an executor exposes a callable `then`.
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
>(
	options: ScheduleGraphOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>
): ScheduleGraphResult<TNodes, TEffects, TProjection> => {
	const graph = options.graph as ErasedGraph;
	const inputs = ownGraphInputs({
		value: options.inputs,
		inputKeys: graph.inputKeys,
	});
	const signal = options.signal ?? new AbortController().signal;
	const state = createState<TEffects>({
		graph,
		inputs,
		capabilities: options.capabilities,
		signal,
		executors: executorTable(graph),
	});
	listenForAbort(state);
	const immediate = driveScheduler(state);
	return (immediate ?? state.completion!.promise) as ScheduleGraphResult<
		TNodes,
		TEffects,
		TProjection
	>;
};
