import type {
	EffectRegistry,
	GraphValue,
	NodeRegistry,
} from '../graph/types.js';
import type {
	GraphScheduleOutcome,
	RunFailure,
	RunOutcome,
} from '../scheduler/types.js';
import {
	commitEffectJournal,
	compensateEffectJournal,
	type JournalSettlement,
} from './settlement.js';
import { projectEffectJournal, projectPreparedEffects } from './runtime.js';
import type { EffectJournalFailure, EffectJournalRuntime } from './types.js';

const directEffectFailures = <TEffects extends EffectRegistry>(
	failures: readonly EffectJournalFailure<TEffects>[]
): readonly EffectJournalFailure<TEffects>[] =>
	failures.filter((failure) => failure.phase !== 'prepare');

const projection = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
>(
	runtime: EffectJournalRuntime<TEffects>,
	graph: GraphScheduleOutcome<
		TNodes,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>
) => ({
	nodes: graph.nodes,
	pendingEffects: projectPreparedEffects(runtime),
	pendingPauses: graph.pendingPauses,
	observerFailures: Object.freeze([]),
	effectJournal: projectEffectJournal(runtime),
	effectFailures: Object.freeze([...runtime.failures]),
	diagnostics: Object.freeze({
		nodes: Object.freeze([]),
		events: Object.freeze([]),
	}),
});

const failureOutcome = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly graph: GraphScheduleOutcome<
		TNodes,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;
	readonly primary: RunFailure<TNodes, TEffects>;
	readonly graphFailures?: readonly RunFailure<TNodes, TEffects>[];
}): RunOutcome<TNodes, Readonly<Record<string, GraphValue>>, TEffects> => {
	const failures = Object.freeze([
		...(options.graphFailures ?? []),
		...directEffectFailures(options.runtime.failures),
	]);
	return Object.freeze({
		...projection(options.runtime, options.graph),
		kind: 'failed',
		primaryFailure: options.primary,
		failures,
	});
};

const projectFailure = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly graph: GraphScheduleOutcome<
		TNodes,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;
	readonly settlement: JournalSettlement<TEffects>;
}):
	| RunOutcome<TNodes, Readonly<Record<string, GraphValue>>, TEffects>
	| undefined => {
	if (options.graph.kind === 'failed') {
		return failureOutcome({
			...options,
			primary: options.graph.primaryFailure,
			graphFailures: options.graph.failures,
		});
	}
	if (
		options.settlement.kind === 'compensated' &&
		options.settlement.triggerFailure
	) {
		return failureOutcome({
			...options,
			primary: options.settlement.triggerFailure,
		});
	}
	const compensationFailure = options.runtime.failures.find(
		(failure) => failure.phase === 'compensate'
	);
	if (compensationFailure) {
		return failureOutcome({
			...options,
			primary: compensationFailure,
		});
	}
	return undefined;
};

const cancellationReason = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
>(options: {
	readonly graph: GraphScheduleOutcome<
		TNodes,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;
	readonly settlement: JournalSettlement<TEffects>;
	readonly signal: AbortSignal;
}): Readonly<Record<string, never>> | { readonly reason: unknown } => {
	if (
		options.graph.kind === 'cancelled' &&
		Object.prototype.hasOwnProperty.call(options.graph, 'reason')
	) {
		return { reason: options.graph.reason };
	}
	if (
		options.settlement.kind === 'compensated' &&
		options.settlement.trigger === 'cancel' &&
		options.signal.reason !== undefined
	) {
		return { reason: options.signal.reason };
	}
	return {};
};

const projectSettlement = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly graph: GraphScheduleOutcome<
		TNodes,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;
	readonly settlement: JournalSettlement<TEffects>;
	readonly signal: AbortSignal;
}): RunOutcome<TNodes, Readonly<Record<string, GraphValue>>, TEffects> => {
	const failed = projectFailure(options);
	if (failed) {
		return failed;
	}
	const projected = projection(options.runtime, options.graph);
	if (
		options.graph.kind === 'succeeded' &&
		options.settlement.kind === 'committed'
	) {
		return Object.freeze({
			...projected,
			kind: 'succeeded',
			outputs: options.graph.outputs,
		});
	}
	return Object.freeze({
		...projected,
		kind: 'cancelled',
		...cancellationReason(options),
	});
};

const compensationTrigger = (
	kind: GraphScheduleOutcome<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		EffectRegistry
	>['kind']
): 'graph' | 'cancel' => {
	if (kind === 'cancelled') {
		return 'cancel';
	}
	return 'graph';
};

/**
 * Settles a drained graph through commit or non-cancellable compensation.
 *
 * @param options         - Terminal graph settlement options.
 * @param options.runtime - Process-local journal runtime.
 * @param options.graph   - Drained graph outcome.
 * @param options.signal  - Run cancellation signal.
 */
export const settleGraphEffects = <
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
>(options: {
	readonly runtime: EffectJournalRuntime<TEffects>;
	readonly graph: GraphScheduleOutcome<
		TNodes,
		Readonly<Record<string, GraphValue>>,
		TEffects
	>;
	readonly signal: AbortSignal;
}):
	| RunOutcome<TNodes, Readonly<Record<string, GraphValue>>, TEffects>
	| Promise<
			RunOutcome<TNodes, Readonly<Record<string, GraphValue>>, TEffects>
	  > => {
	if (options.graph.kind === 'pause-requested') {
		throw new Error('A clean pause must be captured as a Suspension.');
	}
	let settlement:
		| JournalSettlement<TEffects>
		| Promise<JournalSettlement<TEffects>>;
	if (options.graph.kind === 'succeeded') {
		settlement = commitEffectJournal({
			runtime: options.runtime,
			signal: options.signal,
		});
	} else {
		settlement = compensateEffectJournal({
			runtime: options.runtime,
			signal: options.signal,
			trigger: compensationTrigger(options.graph.kind),
		});
	}
	if (settlement instanceof Promise) {
		return settlement.then((settled) =>
			projectSettlement({ ...options, settlement: settled })
		);
	}
	return projectSettlement({ ...options, settlement });
};
