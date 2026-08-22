import type { EffectRegistry } from '../graph/types.js';
import { ownMiddlewareCleanupResult } from '../middleware/ownership.js';
import type {
	CleanCancellation,
	EnteredMiddleware,
	EvaluationContext,
	EvaluationPhase,
	EvaluationRuntime,
	NodeEvaluation,
	NodeEvaluationFailure,
	NodeEvaluationSuccess,
} from './evaluation-types.js';
import {
	enteredOptions,
	evaluationFailure,
	freezeArray,
} from './evaluation-support.js';
import type { PendingEffect } from './types.js';

export const cleanupFailure = <TEffects extends EffectRegistry>(
	context: EvaluationContext<TEffects>,
	phase: 'error' | 'cancel',
	value: unknown
): NodeEvaluationFailure | undefined => {
	const invalid = ownMiddlewareCleanupResult({
		value,
		node: context.node,
		phase,
	});
	return invalid ? evaluationFailure('contract', invalid) : undefined;
};

export const appendEffects = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	effects: readonly PendingEffect<TEffects>[]
): void => {
	for (const effect of effects) {
		runtime.effects.push(effect);
	}
};

export const beginError = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	primary: NodeEvaluationFailure,
	secondary: readonly NodeEvaluationFailure[] = []
): void => {
	runtime.phase = {
		kind: 'error',
		cursor: runtime.entered.length - 1,
		primary,
		secondary: [...secondary],
	};
};

export const beginCancel = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	clean: CleanCancellation | NodeEvaluationSuccess
): void => {
	runtime.phase = {
		kind: 'cancel',
		cursor: runtime.entered.length - 1,
		failures: [],
		clean,
	};
};

export const cancelledBySignal = <TEffects extends EffectRegistry>(
	context: EvaluationContext<TEffects>
): CleanCancellation => ({
	reasonPresent: true,
	reason: context.signal.reason,
});

export const participantOptions = <TEffects extends EffectRegistry>(
	context: EvaluationContext<TEffects>,
	entered: EnteredMiddleware,
	fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
	Object.freeze({ ...enteredOptions(context, entered), ...fields });

const finalEffects = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>
): readonly PendingEffect<TEffects>[] => freezeArray(runtime.effects);

export const completeSuccess = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	success: NodeEvaluationSuccess
): NodeEvaluation<TEffects> =>
	Object.freeze({ ...success, effects: finalEffects(runtime) });

export const completeCancelled = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	cancelled: CleanCancellation
): NodeEvaluation<TEffects> =>
	Object.freeze({
		kind: 'cancelled',
		effects: finalEffects(runtime),
		...(cancelled.reasonPresent ? { reason: cancelled.reason } : {}),
	});

export const completeFailure = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EvaluationRuntime<TEffects>;
	readonly failureClass: 'graph' | 'cancel';
	readonly primary: NodeEvaluationFailure;
	readonly secondary: readonly NodeEvaluationFailure[];
}): NodeEvaluation<TEffects> =>
	Object.freeze({
		kind: 'failure',
		failureClass: options.failureClass,
		effects: finalEffects(options.runtime),
		primaryFailure: options.primary,
		secondaryFailures: freezeArray(options.secondary),
	});

export const beginPreparation = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EvaluationRuntime<TEffects>;
	readonly requests: readonly PendingEffect<TEffects>[];
	readonly next: EvaluationPhase<TEffects>;
	readonly failureDisposition: 'error' | 'after';
}): void => {
	options.runtime.nextEffectOrdinal += options.requests.length;
	options.runtime.phase =
		options.requests.length === 0
			? options.next
			: {
					kind: 'prepare',
					cursor: 0,
					requests: options.requests,
					next: options.next,
					failureDisposition: options.failureDisposition,
				};
};
