import type {
	EffectRegistry,
	GraphValue,
	NodeRegistry,
} from '../graph/types.js';
import { evaluateNode } from './evaluation.js';
import type { NodeEvaluation, NodeEvaluationFailure } from './evaluation.js';
import { GraphSchedulerError } from './errors.js';
import { finaliseSchedule } from './finalise.js';
import { addReadyNode, readyNodeCount, takeReadyNodes } from './ready-queue.js';
import type {
	ErasedScheduleOutcome,
	NodeRuntimeState,
	SchedulerState,
} from './state.js';
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
		const dependency = options.state.nodes.get(key)! as Extract<
			NodeRuntimeState<TEffects>,
			{ readonly kind: 'succeeded' }
		>;
		dependencies[key] = dependency.output;
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
	readonly failure: NodeEvaluationFailure;
}): GraphNodeFailure<NodeRegistry> =>
	Object.freeze({
		kind: options.failure.kind,
		node: options.node,
		nodeOrdinal: options.state.graph.ordinals[options.node]!,
		error: options.failure.error,
	}) as GraphNodeFailure<NodeRegistry>;

const settleFailure = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly primary: NodeEvaluationFailure;
	readonly failureClass?: 'graph' | 'cancel';
	readonly secondary?: readonly NodeEvaluationFailure[];
	readonly effects?: NodeEvaluation<TEffects>['effects'];
}): void => {
	const failure = failureRecord({
		state: options.state,
		node: options.node,
		failure: options.primary,
	});
	const secondaryFailures = Object.freeze(
		(options.secondary ?? []).map((secondary) =>
			failureRecord({
				state: options.state,
				node: options.node,
				failure: secondary,
			})
		)
	);
	options.state.nodes.set(
		options.node,
		Object.freeze({
			kind: 'failed',
			failureClass: options.failureClass ?? 'graph',
			failure,
			secondaryFailures,
			effects: options.effects ?? Object.freeze([]),
		})
	);
	options.state.admissionStopped = true;
	options.state.observers.publishNode({
		node: options.node,
		nodeOrdinal: failure.nodeOrdinal,
		state: 'failed',
	});
};

const unlockDependants = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
}): void => {
	for (const dependant of options.state.graph.outgoing[options.node]!) {
		const runtime = options.state.nodes.get(dependant)! as Extract<
			NodeRuntimeState<TEffects>,
			{ readonly kind: 'pending' }
		>;
		const remainingPredecessors = runtime.remainingPredecessors - 1;
		options.state.nodes.set(
			dependant,
			Object.freeze({ kind: 'pending', remainingPredecessors })
		);
		if (remainingPredecessors === 0) {
			addReadyNode(options.state.ready, dependant);
		}
	}
};

const settleSuccess = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly result: Extract<
		NodeEvaluation<TEffects>,
		{ readonly kind: 'success' }
	>;
}): void => {
	options.state.nodes.set(
		options.node,
		Object.freeze({
			kind: 'succeeded',
			output: options.result.output,
			effects: options.result.effects,
			...(options.result.pause ? { pause: options.result.pause } : {}),
		})
	);
	if (options.result.pause) {
		options.state.admissionStopped = true;
	}
	options.state.observers.publishNode({
		node: options.node,
		nodeOrdinal: options.state.graph.ordinals[options.node]!,
		state: 'succeeded',
	});
	unlockDependants(options);
};

const settleEvaluation = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly evaluation: NodeEvaluation<TEffects>;
}): void => {
	options.state.active -= 1;
	if (options.evaluation.kind === 'success') {
		settleSuccess({ ...options, result: options.evaluation });
		return;
	}
	if (options.evaluation.kind === 'failure') {
		settleFailure({
			...options,
			primary: options.evaluation.primaryFailure,
			failureClass: options.evaluation.failureClass,
			secondary: options.evaluation.secondaryFailures,
			effects: options.evaluation.effects,
		});
		return;
	}
	options.state.nodes.set(
		options.node,
		Object.freeze({
			kind: 'cancelled',
			effects: options.evaluation.effects,
			...(Object.prototype.hasOwnProperty.call(
				options.evaluation,
				'reason'
			)
				? { reason: options.evaluation.reason }
				: {}),
		})
	);
	options.state.admissionStopped = true;
	options.state.observers.publishNode({
		node: options.node,
		nodeOrdinal: options.state.graph.ordinals[options.node]!,
		state: 'cancelled',
	});
};

const settleThrown = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly node: string;
	readonly error: unknown;
}): void => {
	options.state.active -= 1;
	settleFailure({
		...options,
		primary: Object.freeze({ kind: 'thrown', error: options.error }),
	});
};

const normalisePauseConflicts = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): void => {
	const pauses = [...state.nodes.entries()]
		.flatMap(([node, runtime]) =>
			runtime.kind === 'succeeded' && runtime.pause
				? [{ node, nodeOrdinal: runtime.pause.nodeOrdinal }]
				: []
		)
		.sort((left, right) => left.nodeOrdinal - right.nodeOrdinal);
	for (const { node } of pauses.slice(1)) {
		const runtime = state.nodes.get(node)! as Extract<
			NodeRuntimeState<TEffects>,
			{ readonly kind: 'succeeded' }
		>;
		settleFailure({
			state,
			node,
			primary: Object.freeze({
				kind: 'contract',
				error: new GraphSchedulerError({
					code: 'invalid-node-result',
					message: `Node "${node}" returned a concurrent second pause request.`,
				}),
			}),
			effects: runtime.effects,
		});
	}
};

const stopListening = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): void => {
	state.signal.removeEventListener('abort', state.abortListener!);
	state.abortListener = undefined;
};

const withObserverFailures = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	outcome: ErasedScheduleOutcome<TEffects>
): ErasedScheduleOutcome<TEffects> =>
	Object.freeze({
		...outcome,
		observerFailures: state.observers.failures(),
	});

const finish = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
):
	| ErasedScheduleOutcome<TEffects>
	| Promise<ErasedScheduleOutcome<TEffects>> => {
	state.terminal = true;
	stopListening(state);
	normalisePauseConflicts(state);
	const outcome = finaliseSchedule(state);
	const delivery = state.observers.publishTerminal(outcome.kind);
	return delivery
		? delivery.then(() => withObserverFailures(state, outcome))
		: withObserverFailures(state, outcome);
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
		state.nodes.set(node, Object.freeze({ kind: 'active' }));
		state.active += 1;
		state.observers.publishNode({
			node,
			nodeOrdinal: state.graph.ordinals[node]!,
			state: 'active',
		});
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
		if (outcome instanceof Promise) {
			void outcome.then(
				options.state.completion!.resolve,
				options.state.completion!.reject
			);
		} else if (outcome) {
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
	const compiledNode = options.state.graph.nodes[options.node]!;
	let evaluated:
		| NodeEvaluation<TEffects>
		| PromiseLike<NodeEvaluation<TEffects>>;
	try {
		evaluated = evaluateNode<TEffects>({
			node: options.node,
			nodeOrdinal: compiledNode.ordinal,
			effectKeys: compiledNode.effectKeys,
			executor: options.state.executors.get(options.node)!,
			invocation: makeInvocation(options),
			middleware: options.state.middleware.get(options.node) ?? [],
			signal: options.state.signal,
		});
	} catch (error) {
		settleThrown({ ...options, error });
		return;
	}
	if (!(evaluated instanceof Promise)) {
		settleEvaluation({
			...options,
			evaluation: evaluated as NodeEvaluation<TEffects>,
		});
		return;
	}
	options.state.completion ??= createCompletion<TEffects>();
	void evaluated.then(
		(evaluation) =>
			continueAsync({
				state: options.state,
				settle: () => settleEvaluation({ ...options, evaluation }),
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
):
	| ErasedScheduleOutcome<TEffects>
	| Promise<ErasedScheduleOutcome<TEffects>>
	| undefined => {
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
