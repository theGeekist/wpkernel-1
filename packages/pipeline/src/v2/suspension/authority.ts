import type {
	EffectRegistry,
	ErasedGraph,
	GraphValue,
} from '../graph/types.js';
import { createReadyQueue } from '../scheduler/ready-queue.js';
import type {
	ErasedExecutor,
	NodeRuntimeState,
	SchedulerState,
} from '../scheduler/state.js';
import type { CompiledNodeMiddleware } from '../middleware/types.js';
import type { ObserverDispatcher } from '../observers/types.js';
import type { EffectJournalRuntime } from '../effects/types.js';

interface FrontierNode<TEffects extends EffectRegistry> {
	readonly node: string;
	readonly state: Exclude<
		NodeRuntimeState<TEffects>,
		{ readonly kind: 'active' }
	>;
}

/** Runtime-private drained readiness state. */
interface Frontier<TEffects extends EffectRegistry> {
	readonly nodes: readonly FrontierNode<TEffects>[];
	readonly readyHeap: readonly string[];
	readonly nextAdmissionSequence: number;
	readonly nextSettlementSequence: number;
}

interface SuspensionConfiguration<TEffects extends EffectRegistry> {
	readonly graph: ErasedGraph;
	readonly inputs: Readonly<Record<string, GraphValue>>;
	readonly capabilities: unknown;
	readonly signal: AbortSignal;
	readonly executors: ReadonlyMap<string, ErasedExecutor>;
	readonly middleware: CompiledNodeMiddleware;
	readonly observers: ObserverDispatcher;
	readonly journal: EffectJournalRuntime<TEffects>;
}

interface SuspensionAuthority<TEffects extends EffectRegistry> {
	readonly configuration: SuspensionConfiguration<TEffects>;
	readonly frontier: Frontier<TEffects>;
}

const snapshotFrontier = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): Frontier<TEffects> => {
	const nodes = Object.values(state.graph.nodes)
		.sort((left, right) => left.ordinal - right.ordinal)
		.map(({ key }) => {
			const runtime = state.nodes.get(key)! as Exclude<
				NodeRuntimeState<TEffects>,
				{ readonly kind: 'active' }
			>;
			const frontierState =
				runtime.kind === 'succeeded' && runtime.pause
					? Object.freeze({
							kind: runtime.kind,
							admissionSequence: runtime.admissionSequence,
							settlementSequence: runtime.settlementSequence,
							output: runtime.output,
							effects: runtime.effects,
						})
					: runtime;
			return Object.freeze({ node: key, state: frontierState });
		});
	return Object.freeze({
		nodes: Object.freeze(nodes),
		readyHeap: Object.freeze([...state.ready.heap]),
		nextAdmissionSequence: state.nextAdmissionSequence,
		nextSettlementSequence: state.nextSettlementSequence,
	});
};

export const captureSuspensionAuthority = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): SuspensionAuthority<TEffects> => ({
	configuration: Object.freeze({
		graph: state.graph,
		inputs: state.inputs,
		capabilities: state.capabilities,
		signal: state.signal,
		executors: state.executors,
		middleware: state.middleware,
		observers: state.observers,
		journal: state.journal,
	}),
	frontier: snapshotFrontier(state),
});

export const restoreSuspendedState = <
	TEffects extends EffectRegistry,
>(options: {
	readonly authority: SuspensionAuthority<TEffects>;
	readonly signal: AbortSignal;
}): SchedulerState<TEffects> => {
	const { configuration, frontier } = options.authority;
	const ready = createReadyQueue(configuration.graph.ordinals);
	ready.heap.push(...frontier.readyHeap);
	return {
		...configuration,
		signal: options.signal,
		nodes: new Map(
			frontier.nodes.map(({ node, state }) => [node, state] as const)
		),
		ready,
		active: 0,
		nextAdmissionSequence: frontier.nextAdmissionSequence,
		nextSettlementSequence: frontier.nextSettlementSequence,
		admissionStopped: false,
		terminal: false,
	};
};
