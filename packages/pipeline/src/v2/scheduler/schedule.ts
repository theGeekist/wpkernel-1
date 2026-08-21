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
import {
	compileEffectParticipants,
	createEffectJournalRuntime,
} from '../effects/index.js';
import { settleGraphEffects } from '../effects/outcome.js';
import { driveScheduler, listenForAbort } from './engine.js';
import { GraphSchedulerError } from './errors.js';
import { ownGraphInputs } from './ownership.js';
import { addReadyNode, createReadyQueue } from './ready-queue.js';
import type {
	ErasedExecutor,
	ErasedScheduleOutcome,
	SchedulerState,
} from './state.js';
import type {
	RunOutcome,
	ScheduleGraphOptions,
	ScheduleGraphResult,
} from './types.js';

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
		admissionStopped: false,
		terminal: false,
	};
};

const withObserverFailures = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	outcome: RunOutcome<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>
): RunOutcome<NodeRegistry, Readonly<Record<string, GraphValue>>, TEffects> =>
	Object.freeze({
		...outcome,
		observerFailures: state.observers.failures(),
	});

const finishRun = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	outcome: RunOutcome<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>
):
	| RunOutcome<NodeRegistry, Readonly<Record<string, GraphValue>>, TEffects>
	| Promise<
			RunOutcome<
				NodeRegistry,
				Readonly<Record<string, GraphValue>>,
				TEffects
			>
	  > => {
	const delivery = state.observers.publishTerminal(outcome.kind);
	return delivery
		? delivery.then(() => withObserverFailures(state, outcome))
		: withObserverFailures(state, outcome);
};

const settleScheduled = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	outcome: ErasedScheduleOutcome<TEffects>
):
	| RunOutcome<NodeRegistry, Readonly<Record<string, GraphValue>>, TEffects>
	| Promise<
			RunOutcome<
				NodeRegistry,
				Readonly<Record<string, GraphValue>>,
				TEffects
			>
	  > => {
	const settled = settleGraphEffects({
		runtime: state.journal,
		graph: outcome,
		signal: state.signal,
	});
	return settled instanceof Promise
		? settled.then((result) => finishRun(state, result))
		: finishRun(state, settled);
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
	const graph = options.graph as ErasedGraph;
	const inputs = ownGraphInputs({
		value: options.inputs,
		inputKeys: graph.inputKeys,
	});
	const signal = options.signal ?? new AbortController().signal;
	const observers = compileRunObservers({ observers: options.observers });
	const executors = executorTable(graph);
	const participants = compileEffectParticipants({
		graph,
		participants: options.participants,
	});
	const state = createState<TEffects>({
		graph,
		inputs,
		capabilities: options.capabilities,
		signal,
		executors,
		middleware: compileNodeMiddleware({
			graph,
			middleware: options.middleware,
		}),
		observers,
		journal: createEffectJournalRuntime({ participants, observers }),
	});
	listenForAbort(state);
	const immediate = driveScheduler(state);
	const complete = immediate
		? settleScheduled(state, immediate)
		: state.completion!.promise.then((outcome) =>
				settleScheduled(state, outcome)
			);
	return complete as ScheduleGraphResult<TNodes, TEffects, TProjection>;
};
