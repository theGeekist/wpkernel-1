import type {
	EffectRegistry,
	GraphValue,
	NodeRegistry,
} from '../graph/types.js';
import type {
	GraphNodeFailure,
	PendingEffect,
	PendingPause,
	ScheduledNodeOutcome,
} from './types.js';
import type {
	ErasedScheduleOutcome,
	NodeRuntimeState,
	SchedulerState,
} from './state.js';

const stateEffects = <TEffects extends EffectRegistry>(
	runtime: NodeRuntimeState<TEffects>
): readonly PendingEffect<TEffects>[] =>
	runtime.kind === 'succeeded' ||
	runtime.kind === 'failed' ||
	runtime.kind === 'cancelled'
		? runtime.effects
		: [];

const canonicalPauses = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly PendingPause[] => {
	const pauses = [...state.nodes.values()].flatMap((runtime) =>
		runtime.kind === 'succeeded' && runtime.pause ? [runtime.pause] : []
	);
	return Object.freeze(pauses);
};

const blockedOutcome = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly nodeOrdinal: number;
}): ScheduledNodeOutcome<NodeRegistry> => {
	const blockedBy = options.state.graph.incoming[options.node]!.filter(
		(predecessor) =>
			options.state.nodes.get(predecessor)?.kind !== 'succeeded'
	);
	return Object.freeze({
		kind: 'blocked',
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
		reason: blockedBy.length > 0 ? 'dependency' : 'admission-stopped',
		blockedBy: Object.freeze([...blockedBy]),
	}) as ScheduledNodeOutcome<NodeRegistry>;
};

const projectNodeOutcome = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
}): ScheduledNodeOutcome<NodeRegistry> => {
	const runtime = options.state.nodes.get(options.node)!;
	const nodeOrdinal = options.state.graph.ordinals[options.node]!;
	if (runtime.kind === 'pending') {
		return blockedOutcome({ ...options, nodeOrdinal });
	}
	const settled = runtime as Exclude<
		NodeRuntimeState<TEffects>,
		{ readonly kind: 'pending' } | { readonly kind: 'active' }
	>;
	if (settled.kind === 'succeeded') {
		return Object.freeze({
			kind: 'succeeded',
			node: options.node,
			nodeOrdinal,
			output: settled.output,
		}) as ScheduledNodeOutcome<NodeRegistry>;
	}
	if (settled.kind === 'failed') {
		return Object.freeze({
			kind: 'failed',
			node: options.node,
			nodeOrdinal,
			failure: settled.failure,
		}) as ScheduledNodeOutcome<NodeRegistry>;
	}
	return Object.freeze({
		kind: 'cancelled',
		node: options.node,
		nodeOrdinal,
		...(Object.prototype.hasOwnProperty.call(settled, 'reason')
			? { reason: settled.reason }
			: {}),
	}) as ScheduledNodeOutcome<NodeRegistry>;
};

const orderedNodes = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
) =>
	Object.values(state.graph.nodes).sort(
		(left, right) => left.ordinal - right.ordinal
	);

const canonicalNodeOutcomes = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly ScheduledNodeOutcome<NodeRegistry>[] =>
	Object.freeze(
		orderedNodes(state).map((node) =>
			projectNodeOutcome({ state, node: node.key })
		)
	);

const canonicalEffects = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly PendingEffect<TEffects>[] =>
	Object.freeze(
		orderedNodes(state).flatMap((node) =>
			stateEffects(state.nodes.get(node.key)!)
		)
	);

const canonicalFailures = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly GraphNodeFailure<NodeRegistry>[] =>
	Object.freeze(
		(['graph', 'cancel'] as const).flatMap((failureClass) =>
			orderedNodes(state).flatMap((node) => {
				const runtime = state.nodes.get(node.key)!;
				return runtime.kind === 'failed' &&
					runtime.failureClass === failureClass
					? [runtime.failure, ...runtime.secondaryFailures]
					: [];
			})
		)
	);

const projectOutputs = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): Readonly<Record<string, GraphValue>> => {
	const outputs: Record<string, GraphValue> = Object.create(null) as Record<
		string,
		GraphValue
	>;
	for (const [projection, node] of Object.entries(state.graph.outputs)) {
		const runtime = state.nodes.get(node)! as Extract<
			NodeRuntimeState<TEffects>,
			{ readonly kind: 'succeeded' }
		>;
		outputs[projection] = runtime.output;
	}
	return Object.freeze(outputs);
};

export const finaliseSchedule = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): ErasedScheduleOutcome<TEffects> => {
	const pendingPauses = canonicalPauses(state);
	const nodes = canonicalNodeOutcomes(state);
	const pendingEffects = canonicalEffects(state);
	const failures = canonicalFailures(state);
	const projection = {
		nodes,
		pendingEffects,
		pendingPauses,
		observerFailures: Object.freeze([]),
	};

	if (failures.length > 0) {
		return Object.freeze({
			...projection,
			kind: 'failed',
			primaryFailure: failures[0]!,
			failures,
		});
	}
	if (state.signal.aborted) {
		return Object.freeze({
			...projection,
			kind: 'cancelled',
			reason: state.signal.reason,
		});
	}
	if (pendingPauses.length > 0) {
		return Object.freeze({
			...projection,
			kind: 'pause-requested',
			primaryPause: pendingPauses[0]!,
		});
	}
	return Object.freeze({
		...projection,
		kind: 'succeeded',
		outputs: projectOutputs(state),
	});
};
