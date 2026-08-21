import type {
	EffectRegistry,
	GraphValue,
	NodeRegistry,
} from '../graph/types.js';
import { GraphSchedulerError } from './errors.js';
import type {
	GraphNodeFailure,
	PendingEffect,
	PendingPause,
	ScheduledNodeOutcome,
} from './types.js';
import type { ErasedScheduleOutcome, SchedulerState } from './state.js';

const byNodeOrdinal = (
	left: { readonly nodeOrdinal: number },
	right: { readonly nodeOrdinal: number }
): number => left.nodeOrdinal - right.nodeOrdinal;

const pauseConflict = (pause: PendingPause): GraphNodeFailure<NodeRegistry> => {
	const error = new GraphSchedulerError({
		code: 'invalid-node-result',
		message: `Node "${pause.node}" returned a concurrent second pause request.`,
	});
	return Object.freeze({
		kind: 'contract',
		node: pause.node,
		nodeOrdinal: pause.nodeOrdinal,
		error,
	});
};

const normalisePauses = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly PendingPause[] => {
	const pauses = [...state.pauses.values()].sort(byNodeOrdinal);
	for (const pause of pauses.slice(1)) {
		const failure = pauseConflict(pause);
		state.failures.set(pause.node, failure);
		state.status.set(pause.node, 'failed');
		state.outputs.delete(pause.node);
		state.effects.delete(pause.node);
		state.pauses.delete(pause.node);
		state.outcomes.set(
			pause.node,
			Object.freeze({
				kind: 'failed',
				node: pause.node,
				nodeOrdinal: pause.nodeOrdinal,
				failure,
			})
		);
	}
	return Object.freeze(pauses.length === 0 ? [] : [pauses[0]!]);
};

const blockPendingNodes = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): void => {
	for (const node of Object.values(state.graph.nodes)) {
		if (state.status.get(node.key) !== 'pending') {
			continue;
		}
		const blockedBy = state.graph.incoming[node.key]!.filter(
			(predecessor) => state.status.get(predecessor) !== 'succeeded'
		);
		state.outcomes.set(
			node.key,
			Object.freeze({
				kind: 'blocked',
				node: node.key,
				nodeOrdinal: node.ordinal,
				reason:
					blockedBy.length > 0 ? 'dependency' : 'admission-stopped',
				blockedBy: Object.freeze([...blockedBy]),
			})
		);
	}
};

const canonicalNodeOutcomes = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly ScheduledNodeOutcome<NodeRegistry>[] =>
	Object.freeze(
		Object.values(state.graph.nodes)
			.sort((left, right) => left.ordinal - right.ordinal)
			.map((node) => state.outcomes.get(node.key)!)
	);

const canonicalEffects = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly PendingEffect<TEffects>[] =>
	Object.freeze(
		Object.values(state.graph.nodes)
			.sort((left, right) => left.ordinal - right.ordinal)
			.flatMap((node) => state.effects.get(node.key) ?? [])
	);

const projectOutputs = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): Readonly<Record<string, GraphValue>> => {
	const outputs: Record<string, GraphValue> = Object.create(null) as Record<
		string,
		GraphValue
	>;
	for (const [projection, node] of Object.entries(state.graph.outputs)) {
		outputs[projection] = state.outputs.get(node)!;
	}
	return Object.freeze(outputs);
};

export const finaliseSchedule = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): ErasedScheduleOutcome<TEffects> => {
	const pendingPauses = normalisePauses(state);
	blockPendingNodes(state);
	const nodes = canonicalNodeOutcomes(state);
	const pendingEffects = canonicalEffects(state);
	const failures = Object.freeze(
		[...state.failures.values()].sort(byNodeOrdinal)
	);
	const projection = { nodes, pendingEffects, pendingPauses };

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
