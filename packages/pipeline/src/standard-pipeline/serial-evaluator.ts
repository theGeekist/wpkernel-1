import { observeParticipant } from '../v2/scheduler/maybe-promise.js';
import type { ErasedExtension } from './serial-authority.js';
import {
	hasControlFlag,
	rejectNonTerminalHalt,
	rejectUnsupportedPause,
} from './serial-control.js';
import { admitExtensionResult } from './serial-extensions.js';
import { runHelperPhase } from './serial-helper-evaluator.js';
import { invokePublic } from './serial-invoke.js';
import { invokeObserved, settleObserved } from './serial-observe.js';
import type { SerialEvaluationState } from './serial-ordering.js';

type EvaluationPhase =
	| 'fragments'
	| 'finalize-fragments'
	| 'after-fragments'
	| 'before-builders'
	| 'builders'
	| 'after-builders'
	| 'finalize'
	| 'complete';
const runExtensionAt = (
	state: SerialEvaluationState,
	hooks: readonly ErasedExtension[],
	extensionKeys: readonly string[],
	index: number
): void | Promise<void> => {
	const extension = hooks[index];
	if (!extension) {
		return;
	}
	const journalOrdinal = state.nextJournalOrdinal;
	state.nextJournalOrdinal += 1;
	return settleObserved(
		invokeObserved<unknown>(extension.hook, [
			{
				context: state.context,
				options: state.run.options,
				artifact: state.artifact,
				lifecycle: extension.lifecycle,
			},
		]),
		(result) => {
			rejectUnsupportedPause(state, result);
			rejectNonTerminalHalt(state, result);
			admitExtensionResult({
				state,
				extension,
				extensionKeys,
				journalOrdinal,
				returned: result,
			});
			return runExtensionAt(state, hooks, extensionKeys, index + 1);
		},
		(error) => {
			throw error;
		}
	);
};

const runLifecycle = (
	state: SerialEvaluationState,
	lifecycle: string
): void | Promise<void> => {
	const hooks = state.authority.extensions.filter(
		(extension) => extension.lifecycle === lifecycle
	);
	return runExtensionAt(
		state,
		hooks,
		Object.freeze(hooks.map((extension) => extension.key)),
		0
	);
};

function nextEvaluationPhase(phase: EvaluationPhase): EvaluationPhase {
	switch (phase) {
		case 'fragments':
			return 'finalize-fragments';
		case 'finalize-fragments':
			return 'after-fragments';
		case 'after-fragments':
			return 'before-builders';
		case 'before-builders':
			return 'builders';
		case 'builders':
			return 'after-builders';
		case 'after-builders':
			return 'finalize';
		default:
			return 'complete';
	}
}

function executeEvaluationPhase(
	state: SerialEvaluationState,
	phase: Exclude<EvaluationPhase, 'complete'>
): void | Promise<void> {
	switch (phase) {
		case 'fragments':
			return runHelperPhase(state, 'fragments');
		case 'finalize-fragments':
			state.artifact = invokePublic(
				state.authority.finalizeFragmentState,
				{
					draft: state.draft,
					options: state.run.options,
					context: state.context,
					buildOptions: state.buildOptions,
					helpers: {
						fragments: state.helpers.get(
							state.authority.fragmentKind
						)!,
					},
				}
			);
			return;
		case 'after-fragments':
			return runLifecycle(state, 'after-fragments');
		case 'before-builders':
			return runLifecycle(state, 'before-builders');
		case 'builders':
			return runHelperPhase(state, 'builders');
		case 'after-builders':
			return runLifecycle(state, 'after-builders');
		case 'finalize':
			return runLifecycle(state, 'finalize');
	}
}

export function invokeSerialResult(
	authority: SerialEvaluationState['authority'],
	resultOptions: Record<string, unknown>
): unknown {
	return authority.createRunResult
		? invokePublic(authority.createRunResult, resultOptions)
		: {
				artifact: resultOptions.artifact,
				diagnostics: resultOptions.diagnostics,
				steps: resultOptions.steps,
			};
}

export function projectSerialResult(
	authority: SerialEvaluationState['authority'],
	result: unknown
): unknown {
	const control = { authority };
	rejectUnsupportedPause(control, result);
	if (!hasControlFlag(result, '__halt')) {
		return result;
	}
	if (
		result.__hasError === true ||
		Object.prototype.hasOwnProperty.call(result, 'error')
	) {
		throw result.error;
	}
	return Object.prototype.hasOwnProperty.call(result, 'result')
		? result.result
		: undefined;
}

function evaluateFromPhase(
	state: SerialEvaluationState,
	initialPhase: EvaluationPhase
): void | Promise<void> {
	let phase = initialPhase;
	while (phase !== 'complete') {
		const observed = observeParticipant(
			executeEvaluationPhase(
				state,
				phase as Exclude<EvaluationPhase, 'complete'>
			)
		);
		const next = nextEvaluationPhase(phase);
		if (observed.kind === 'asynchronous') {
			return observed.promise.then(() => evaluateFromPhase(state, next));
		}
		phase = next;
	}
	return undefined;
}

export function evaluateSerialStages(
	state: SerialEvaluationState
): void | Promise<void> {
	return evaluateFromPhase(state, 'fragments');
}
