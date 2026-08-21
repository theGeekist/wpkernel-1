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
import { compileRunObservers } from '../observers/dispatcher.js';
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
	readonly middleware: SchedulerState<TEffects>['middleware'];
	readonly observers: SchedulerState<TEffects>['observers'];
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
		nodes,
		ready,
		active: 0,
		admissionStopped: false,
		terminal: false,
	};
};

/**
 * Schedules one compiled immutable graph directly from dependency readiness.
 * Executor and middleware phase thenables promote node evaluation. Observer
 * thenables never gate admission and may promote only terminal settlement.
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
	const TMiddleware extends readonly NodeMiddlewareRegistration[],
>(
	options: ScheduleGraphOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities,
		TMiddleware
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
		middleware: compileNodeMiddleware({
			graph,
			middleware: options.middleware,
		}),
		observers: compileRunObservers({ observers: options.observers }),
	});
	listenForAbort(state);
	const immediate = driveScheduler(state);
	return (immediate ?? state.completion!.promise) as ScheduleGraphResult<
		TNodes,
		TEffects,
		TProjection
	>;
};
