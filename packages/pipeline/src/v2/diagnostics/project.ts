import type { EffectRegistry } from '../graph/types.js';
import { projectRunEvents } from '../observers/dispatcher.js';
import type { NodeRuntimeState, SchedulerState } from '../scheduler/state.js';
import type { NodeDiagnostic, RunDiagnostics } from './types.js';

const blockedBy = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	node: string
): readonly string[] =>
	Object.freeze(
		state.graph.incoming[node]!.filter(
			(predecessor) => state.nodes.get(predecessor)?.kind !== 'succeeded'
		)
	);

const pendingDiagnostic = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly runtime: Extract<
		NodeRuntimeState<TEffects>,
		{ readonly kind: 'pending' }
	>;
}): NodeDiagnostic => {
	const dependencies = blockedBy(options.state, options.node);
	return Object.freeze({
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
		state: 'pending',
		readiness:
			options.runtime.remainingPredecessors === 0 ? 'ready' : 'blocked',
		...(dependencies.length > 0 ? { blockedBy: dependencies } : {}),
	});
};

const settledDiagnostic = <TEffects extends EffectRegistry>(options: {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly runtime: Exclude<
		NodeRuntimeState<TEffects>,
		{ readonly kind: 'pending' } | { readonly kind: 'active' }
	>;
}): NodeDiagnostic =>
	Object.freeze({
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
		state: options.runtime.kind,
		admissionSequence: options.runtime.admissionSequence,
		settlementSequence: options.runtime.settlementSequence,
	});

const projectNode = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
}): NodeDiagnostic => {
	const runtime = options.state.nodes.get(options.node)!;
	const nodeOrdinal = options.state.graph.ordinals[options.node]!;
	if (runtime.kind === 'pending') {
		return pendingDiagnostic({ ...options, nodeOrdinal, runtime });
	}
	return settledDiagnostic({
		...options,
		nodeOrdinal,
		runtime: runtime as Exclude<
			NodeRuntimeState<TEffects>,
			{ readonly kind: 'pending' } | { readonly kind: 'active' }
		>,
	});
};

/**
 * Projects passive diagnostics from a drained scheduler state.
 *
 * @internal
 * @param state - Drained scheduler authority to project without controlling it.
 */
export const projectRunDiagnostics = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): RunDiagnostics =>
	Object.freeze({
		nodes: Object.freeze(
			Object.values(state.graph.nodes)
				.sort((left, right) => left.ordinal - right.ordinal)
				.map(({ key }) => projectNode({ state, node: key }))
		),
		events: projectRunEvents(state.observers),
	});
