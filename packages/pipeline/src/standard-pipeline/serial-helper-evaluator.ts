import type { RegisteredHelper } from '../core/dependency-graph.js';
import type {
	HelperApplyOptions,
	HelperApplyResult,
	HelperNext,
	PipelineStep,
} from '../core/types.js';
import { observeParticipant } from '../v2/scheduler/maybe-promise.js';
import type { ErasedHelper } from './serial-authority.js';
import {
	rejectNonTerminalHalt,
	rejectUnsupportedPause,
} from './serial-control.js';
import {
	retainHelperRollback,
	snapshotHelperRollbacks,
	snapshotSuccessfulHelperPhase,
	type PendingHelperRollback,
} from './serial-helper-rollbacks.js';
import { invokePublic } from './serial-invoke.js';
import {
	chainObserved,
	invokeObserved,
	settleObserved,
} from './serial-observe.js';
import type { SerialEvaluationState } from './serial-ordering.js';

interface OutputState {
	readonly present: boolean;
	readonly value: unknown;
}

type HelperPhase = 'fragments' | 'builders';

type ContinuationState =
	| { readonly kind: 'idle' }
	| { readonly kind: 'pending'; readonly promise: Promise<unknown> }
	| { readonly kind: 'settled'; readonly value: unknown }
	| { readonly kind: 'failed'; readonly error: unknown };

interface HelperPhaseData {
	readonly state: SerialEvaluationState;
	readonly order: readonly RegisteredHelper<ErasedHelper>[];
	readonly phase: HelperPhase;
	readonly pendingRollbacks: PendingHelperRollback[];
}

function makeHelperArgs(
	state: SerialEvaluationState,
	entry: RegisteredHelper<ErasedHelper>,
	phase: HelperPhase
): HelperApplyOptions<unknown, unknown, unknown> {
	return phase === 'fragments'
		? invokePublic(state.authority.createFragmentArgs, {
				helper: entry.helper.attribution,
				options: state.run.options,
				context: state.context,
				buildOptions: state.buildOptions,
				draft: state.draft,
			})
		: invokePublic(state.authority.createBuilderArgs, {
				helper: entry.helper.attribution,
				options: state.run.options,
				context: state.context,
				buildOptions: state.buildOptions,
				artifact: state.artifact,
			});
}

function adoptHelperOutput(
	state: SerialEvaluationState,
	phase: HelperPhase,
	output: unknown
): void {
	if (phase === 'fragments' && state.authority.adoptFragmentOutput) {
		state.draft = invokePublic(state.authority.adoptFragmentOutput, {
			draft: state.draft,
			output,
		});
	}
	if (phase === 'builders' && state.authority.adoptBuilderOutput) {
		state.artifact = invokePublic(state.authority.adoptBuilderOutput, {
			artifact: state.artifact,
			output,
		});
	}
}

const runHelperAt = (
	data: HelperPhaseData,
	index: number,
	incoming?: OutputState
): OutputState | Promise<OutputState> => {
	const { state, order, phase, pendingRollbacks } = data;
	const entry = order[index];
	if (!entry) {
		return incoming ?? { present: false, value: undefined };
	}

	state.steps.push(
		Object.freeze({
			key: entry.helper.key,
			kind: entry.helper.kind,
			mode: entry.helper.mode,
			priority: entry.helper.priority,
			dependsOn: entry.helper.dependsOn,
			origin: entry.helper.origin,
			id: entry.id,
			index: entry.index,
		}) as PipelineStep
	);
	const snapshot = state.helpers.get(entry.helper.kind)!;
	(snapshot.executed as string[]).push(entry.helper.key);

	const baseArgs = makeHelperArgs(state, entry, phase);
	const current = incoming?.present
		? incoming
		: { present: true, value: baseArgs.output };
	const args = { ...baseArgs, output: current.value };
	const journalOrdinal = state.nextJournalOrdinal;
	state.nextJournalOrdinal += 1;
	let continuation: ContinuationState = { kind: 'idle' };
	let nextOpen = true;

	const continueFromHelper: HelperNext<unknown> = (
		...nextArgs: [] | [unknown]
	) => {
		if (continuation.kind === 'pending') {
			return continuation.promise;
		}
		if (continuation.kind === 'settled') {
			return continuation.value;
		}
		if (continuation.kind === 'failed') {
			throw continuation.error;
		}
		let downstream: OutputState | Promise<OutputState>;
		try {
			downstream = runHelperAt(data, index + 1, {
				present: true,
				value: nextArgs.length === 0 ? current.value : nextArgs[0],
			});
		} catch (error) {
			continuation = { kind: 'failed', error };
			throw error;
		}
		if (!(downstream instanceof Promise)) {
			continuation = { kind: 'settled', value: downstream.value };
			return downstream.value;
		}
		const promise = downstream.then(
			(output) => {
				continuation = { kind: 'settled', value: output.value };
				return output.value;
			},
			(error: unknown) => {
				continuation = { kind: 'failed', error };
				throw error;
			}
		);
		void promise.catch(() => undefined);
		continuation = { kind: 'pending', promise };
		return promise;
	};
	const next: HelperNext<unknown> = (...nextArgs: [] | [unknown]) => {
		if (!nextOpen) {
			throw new TypeError('next is no longer active for this helper.');
		}
		return Reflect.apply(continueFromHelper, undefined, nextArgs);
	};

	return settleObserved(
		invokeObserved<HelperApplyResult<unknown> | void>(entry.helper.apply, [
			args,
			next,
		]),
		(result) => {
			nextOpen = false;
			rejectUnsupportedPause(state, result);
			rejectNonTerminalHalt(state, result);
			retainHelperRollback(
				pendingRollbacks,
				entry.helper,
				journalOrdinal,
				result
			);
			const hasOutput =
				!!result && typeof result === 'object' && 'output' in result;
			const returned = hasOutput
				? { present: true, value: result.output }
				: current;
			if (continuation.kind === 'idle') {
				return chainObserved(
					continueFromHelper(returned.value),
					(value) => ({
						present: true,
						value,
					})
				);
			}
			if (continuation.kind === 'pending') {
				return continuation.promise.then((value) =>
					hasOutput ? returned : { present: true, value }
				);
			}
			if (continuation.kind === 'failed') {
				if (hasOutput) {
					return returned;
				}
				throw continuation.error;
			}
			return hasOutput
				? returned
				: { present: true, value: continuation.value };
		},
		(error) => {
			nextOpen = false;
			if (continuation.kind !== 'pending') {
				throw error;
			}
			return continuation.promise.then(
				() => {
					throw error;
				},
				() => {
					throw error;
				}
			);
		}
	);
};

export const runHelperPhase = (
	state: SerialEvaluationState,
	phase: HelperPhase
): void | Promise<void> => {
	const kind =
		phase === 'fragments'
			? state.authority.fragmentKind
			: state.authority.builderKind;
	const order =
		phase === 'fragments' ? state.fragmentOrder : state.builderOrder;
	state.helpers.set(kind, {
		kind,
		registered: order.map((entry) => entry.helper.key),
		executed: [],
		missing: [],
	});
	const pendingRollbacks: PendingHelperRollback[] = [];
	const data: HelperPhaseData = { state, order, phase, pendingRollbacks };
	let evaluated: OutputState | Promise<OutputState>;
	try {
		evaluated = runHelperAt(data, 0);
	} catch (error) {
		snapshotHelperRollbacks(state.journal, pendingRollbacks);
		throw error;
	}
	return settleObserved(
		observeParticipant<OutputState>(evaluated),
		(output) => {
			try {
				if (output.present) {
					adoptHelperOutput(state, phase, output.value);
				}
			} catch (error) {
				snapshotHelperRollbacks(state.journal, pendingRollbacks);
				throw error;
			}
			snapshotSuccessfulHelperPhase(state.journal, pendingRollbacks);
		},
		(error) => {
			snapshotHelperRollbacks(state.journal, pendingRollbacks);
			throw error;
		}
	);
};
