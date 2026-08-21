import type {
	EffectRegistry,
	GraphValue,
	NodeRegistry,
} from '../graph/types.js';
import { GraphSchedulerError } from './errors.js';
import { finaliseSchedule } from './finalise.js';
import { observeParticipant } from './maybe-promise.js';
import { ownNodeResult } from './ownership.js';
import { addReadyNode, readyNodeCount, takeReadyNodes } from './ready-queue.js';
import type { ErasedScheduleOutcome, SchedulerState } from './state.js';
import { createCompletion } from './state.js';
import type { GraphNodeFailure } from './types.js';

const nullRecord = (): Record<string, GraphValue> =>
	Object.create(null) as Record<string, GraphValue>;

const makeInvocation = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
}) => {
	const node = options.state.graph.nodes[options.node]!;
	const external = nullRecord();
	for (const key of node.externalInputs) {
		external[key] = options.state.inputs[key]!;
	}
	const dependencies = nullRecord();
	for (const key of options.state.graph.incoming[node.key]!) {
		dependencies[key] = options.state.outputs.get(key)!;
	}
	return Object.freeze({
		input: Object.freeze({
			external: Object.freeze(external),
			dependencies: Object.freeze(dependencies),
		}),
		capabilities: options.state.capabilities,
		signal: options.state.signal,
	});
};

const failureRecord = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly kind: GraphNodeFailure<NodeRegistry>['kind'];
	readonly error: unknown;
}): GraphNodeFailure<NodeRegistry> => {
	const nodeOrdinal = options.state.graph.ordinals[options.node]!;
	return Object.freeze({
		kind: options.kind,
		node: options.node,
		nodeOrdinal,
		error: options.error,
	}) as GraphNodeFailure<NodeRegistry>;
};

const settleFailure = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly kind: GraphNodeFailure<NodeRegistry>['kind'];
	readonly error: unknown;
}): void => {
	const failure = failureRecord({
		state: options.state,
		node: options.node,
		kind: options.kind,
		error: options.error,
	});
	options.state.status.set(options.node, 'failed');
	options.state.failures.set(options.node, failure);
	options.state.admissionStopped = true;
	options.state.outcomes.set(
		options.node,
		Object.freeze({
			kind: 'failed',
			node: options.node,
			nodeOrdinal: failure.nodeOrdinal,
			failure,
		})
	);
};

const addReady = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	node: string
): void => {
	addReadyNode(state.ready, node);
};

const unlockDependants = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
}): void => {
	for (const dependant of options.state.graph.outgoing[options.node]!) {
		const remaining =
			options.state.remainingPredecessors.get(dependant)! - 1;
		options.state.remainingPredecessors.set(dependant, remaining);
		if (remaining === 0) {
			addReady(options.state, dependant);
		}
	}
};

const settleSuccess = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly result: Extract<
		ReturnType<typeof ownNodeResult<TEffects>>,
		{ readonly kind: 'success' }
	>;
}): void => {
	const nodeOrdinal = options.state.graph.ordinals[options.node]!;
	options.state.status.set(options.node, 'succeeded');
	options.state.outputs.set(options.node, options.result.output);
	options.state.effects.set(options.node, options.result.effects);
	if (options.result.pause) {
		options.state.pauses.set(options.node, options.result.pause);
		options.state.admissionStopped = true;
	}
	options.state.outcomes.set(
		options.node,
		Object.freeze({
			kind: 'succeeded',
			node: options.node,
			nodeOrdinal,
			output: options.result.output,
		})
	);
	unlockDependants(options);
};

const settleValue = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly value: unknown;
}): void => {
	options.state.active -= 1;
	const compiledNode = options.state.graph.nodes[options.node]!;
	const result = ownNodeResult<TEffects>({
		value: options.value,
		node: options.node,
		nodeOrdinal: compiledNode.ordinal,
		effectKeys: compiledNode.effectKeys,
	});
	if (result.kind === 'success') {
		settleSuccess({ ...options, result });
		return;
	}
	if (result.kind === 'failure') {
		settleFailure({ ...options, kind: 'declared', error: result.error });
		return;
	}
	if (result.kind === 'contract') {
		settleFailure({ ...options, kind: 'contract', error: result.error });
		return;
	}
	if (!options.state.signal.aborted) {
		settleFailure({
			...options,
			kind: 'contract',
			error: new GraphSchedulerError({
				code: 'invalid-node-result',
				message: `Node "${options.node}" returned cancelled before its signal was aborted.`,
			}),
		});
		return;
	}
	options.state.status.set(options.node, 'cancelled');
	options.state.admissionStopped = true;
	options.state.outcomes.set(
		options.node,
		Object.freeze({
			kind: 'cancelled',
			node: options.node,
			nodeOrdinal: compiledNode.ordinal,
			...(Object.prototype.hasOwnProperty.call(result, 'reason')
				? { reason: result.reason }
				: {}),
		})
	);
};

const settleThrown = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly error: unknown;
}): void => {
	options.state.active -= 1;
	settleFailure({ ...options, kind: 'thrown' });
};

const stopListening = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): void => {
	state.signal.removeEventListener('abort', state.abortListener!);
	state.abortListener = undefined;
};

const finish = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): ErasedScheduleOutcome<TEffects> => {
	state.terminal = true;
	stopListening(state);
	return finaliseSchedule(state);
};

const selectAdmission = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): readonly string[] => {
	if (state.admissionStopped || readyNodeCount(state.ready) === 0) {
		return [];
	}
	const maximum = state.graph.policy.maxConcurrency;
	const capacity =
		maximum === 'unbounded'
			? readyNodeCount(state.ready)
			: maximum - state.active;
	if (capacity <= 0) {
		return [];
	}
	const selected = takeReadyNodes(state.ready, capacity);
	for (const node of selected) {
		state.status.set(node, 'active');
		state.active += 1;
	}
	return selected;
};

const continueAsync = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly settle: () => void;
}): void => {
	if (options.state.terminal) {
		return;
	}
	try {
		options.settle();
		const outcome = driveScheduler(options.state);
		if (outcome) {
			options.state.completion!.resolve(outcome);
		}
	} catch (error) {
		options.state.terminal = true;
		stopListening(options.state);
		options.state.completion!.reject(error);
	}
};

const invokeNode = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
}): void => {
	let returned: unknown;
	try {
		returned = options.state.executors.get(options.node)!(
			makeInvocation(options)
		);
	} catch (error) {
		settleThrown({ ...options, error });
		return;
	}
	const observed = observeParticipant(returned);
	if (observed.kind === 'synchronous') {
		settleValue({ ...options, value: observed.value });
		return;
	}
	if (observed.kind === 'failed') {
		settleThrown({ ...options, error: observed.error });
		return;
	}
	options.state.completion ??= createCompletion<TEffects>();
	void observed.promise.then(
		(value) =>
			continueAsync({
				state: options.state,
				settle: () => settleValue({ ...options, value }),
			}),
		(error: unknown) =>
			continueAsync({
				state: options.state,
				settle: () => settleThrown({ ...options, error }),
			})
	);
};

export const driveScheduler = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): ErasedScheduleOutcome<TEffects> | undefined => {
	while (true) {
		if (state.signal.aborted) {
			state.admissionStopped = true;
		}
		const selected = selectAdmission(state);
		if (selected.length > 0) {
			for (const node of selected) {
				invokeNode({ state, node });
			}
			continue;
		}
		if (state.active > 0) {
			return undefined;
		}
		return finish(state);
	}
};

export const listenForAbort = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): void => {
	const listener = (): void => {
		state.admissionStopped = true;
	};
	state.abortListener = listener;
	state.signal.addEventListener('abort', listener, { once: true });
};
