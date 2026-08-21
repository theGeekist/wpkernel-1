import type { EffectRegistry, MaybePromise } from '../graph/types.js';
import {
	ownMiddlewareAfterResult,
	ownMiddlewareBeforeResult,
	ownMiddlewareCleanupResult,
} from '../middleware/ownership.js';
import type { ErasedNodeMiddleware } from '../middleware/types.js';
import { GraphSchedulerError } from './errors.js';
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
	enterMiddleware,
	evaluationFailure as failure,
	freezeArray,
	invokeParticipant,
} from './evaluation-support.js';
import type { ObservedParticipant } from './maybe-promise.js';
import { ownNodeResult } from './ownership.js';
import type { PendingEffect } from './types.js';

type BeforePhase = Extract<EvaluationPhase, { kind: 'before' }>;
type AfterPhase = Extract<EvaluationPhase, { kind: 'after' }>;
type ErrorPhase = Extract<EvaluationPhase, { kind: 'error' }>;
type CancelPhase = Extract<EvaluationPhase, { kind: 'cancel' }>;
type EvaluationAdvance<TEffects extends EffectRegistry> =
	| NodeEvaluation<TEffects>
	| Promise<NodeEvaluation<TEffects>>
	| undefined;

const cleanupFailure = (
	context: EvaluationContext,
	phase: 'error' | 'cancel',
	value: unknown
): NodeEvaluationFailure | undefined => {
	const invalid = ownMiddlewareCleanupResult({
		value,
		node: context.node,
		phase,
	});
	return invalid ? failure('contract', invalid) : undefined;
};

const appendEffects = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	effects: readonly PendingEffect<TEffects>[]
): void => {
	for (const effect of effects) {
		runtime.effects.push(effect);
	}
};

const beginError = <TEffects extends EffectRegistry>(
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

const beginCancel = <TEffects extends EffectRegistry>(
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

const cancelledBySignal = (context: EvaluationContext): CleanCancellation => ({
	reasonPresent: true,
	reason: context.signal.reason,
});

const participantOptions = (
	context: EvaluationContext,
	entered: EnteredMiddleware,
	fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
	Object.freeze({ ...enteredOptions(context, entered), ...fields });

const finalEffects = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>
): readonly PendingEffect<TEffects>[] => freezeArray(runtime.effects);

const completeSuccess = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	success: NodeEvaluationSuccess
): NodeEvaluation<TEffects> =>
	Object.freeze({ ...success, effects: finalEffects(runtime) });

const completeCancelled = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	cancelled: CleanCancellation
): NodeEvaluation<TEffects> =>
	Object.freeze({
		kind: 'cancelled',
		effects: finalEffects(runtime),
		...(cancelled.reasonPresent ? { reason: cancelled.reason } : {}),
	});

const completeFailure = <TEffects extends EffectRegistry>(options: {
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

const processBeforeValue = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EvaluationRuntime<TEffects>;
	readonly middleware: ErasedNodeMiddleware;
	readonly nextCursor: number;
	readonly value: unknown;
}): void => {
	const { runtime } = options;
	const owned = ownMiddlewareBeforeResult<TEffects>({
		value: options.value,
		node: runtime.context.node,
		nodeOrdinal: runtime.context.nodeOrdinal,
		effectOrdinalStart: runtime.effects.length,
		effectKeys: runtime.context.effectKeys,
	});
	if (!owned.ok) {
		beginError(runtime, failure('contract', owned.error));
		return;
	}
	runtime.entered.push(enterMiddleware(options.middleware, owned.state));
	if (runtime.context.signal.aborted) {
		beginCancel(runtime, cancelledBySignal(runtime.context));
		return;
	}
	appendEffects(runtime, owned.effects);
	runtime.phase = { kind: 'before', cursor: options.nextCursor };
};

const processNodeValue = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	value: unknown
): void => {
	const result = ownNodeResult<TEffects>({
		value,
		node: runtime.context.node,
		nodeOrdinal: runtime.context.nodeOrdinal,
		effectKeys: runtime.context.effectKeys,
		effectOrdinalStart: runtime.effects.length,
	});
	if (result.kind === 'failure') {
		beginError(runtime, failure('declared', result.error));
		return;
	}
	if (result.kind === 'contract') {
		beginError(runtime, failure('contract', result.error));
		return;
	}
	if (result.kind === 'cancelled') {
		processDeclaredCancellation(runtime, result);
		return;
	}
	if (!runtime.context.signal.aborted) {
		appendEffects(runtime, result.effects);
	}
	runtime.phase = {
		kind: 'after',
		cursor: runtime.entered.length - 1,
		output: result.output,
		...(result.pause ? { pause: result.pause } : {}),
		failures: [],
	};
};

const processDeclaredCancellation = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	result: Readonly<{ readonly kind: 'cancelled'; readonly reason?: unknown }>
): void => {
	if (!runtime.context.signal.aborted) {
		beginError(
			runtime,
			failure(
				'contract',
				new GraphSchedulerError({
					code: 'invalid-node-result',
					message: `Node "${runtime.context.node}" returned cancelled before its signal was aborted.`,
				})
			)
		);
		return;
	}
	beginCancel(
		runtime,
		Object.prototype.hasOwnProperty.call(result, 'reason')
			? { reasonPresent: true, reason: result.reason }
			: { reasonPresent: false }
	);
};

const processAfterValue = <TEffects extends EffectRegistry>(options: {
	readonly runtime: EvaluationRuntime<TEffects>;
	readonly phase: AfterPhase;
	readonly value: unknown;
}): void => {
	const owned = ownMiddlewareAfterResult<TEffects>({
		value: options.value,
		node: options.runtime.context.node,
		nodeOrdinal: options.runtime.context.nodeOrdinal,
		effectOrdinalStart: options.runtime.effects.length,
		effectKeys: options.runtime.context.effectKeys,
	});
	if (!owned.ok) {
		options.phase.failures.push(failure('contract', owned.error));
	} else if (!options.runtime.context.signal.aborted) {
		appendEffects(options.runtime, owned.effects);
	}
	options.phase.cursor -= 1;
};

const resumeParticipant = <T, TEffects extends EffectRegistry>(options: {
	readonly runtime: EvaluationRuntime<TEffects>;
	readonly observed: ObservedParticipant<T>;
	readonly onValue: (value: T) => void;
	readonly onFailure: (error: unknown) => void;
}): Promise<NodeEvaluation<TEffects>> | undefined => {
	if (options.observed.kind === 'synchronous') {
		options.onValue(options.observed.value);
		return undefined;
	}
	if (options.observed.kind === 'failed') {
		options.onFailure(options.observed.error);
		return undefined;
	}
	return options.observed.promise.then(
		(value) => {
			options.onValue(value);
			return driveEvaluation(options.runtime);
		},
		(error: unknown) => {
			options.onFailure(error);
			return driveEvaluation(options.runtime);
		}
	);
};

const advanceBefore = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	phase: BeforePhase
): EvaluationAdvance<TEffects> => {
	const middleware = runtime.context.middleware[phase.cursor];
	if (!middleware) {
		runtime.phase = { kind: 'node' };
		return undefined;
	}
	const nextCursor = phase.cursor + 1;
	if (!middleware.before) {
		runtime.entered.push(enterMiddleware(middleware, undefined));
		if (runtime.context.signal.aborted) {
			beginCancel(runtime, cancelledBySignal(runtime.context));
		} else {
			phase.cursor = nextCursor;
		}
		return undefined;
	}
	return resumeParticipant({
		runtime,
		observed: invokeParticipant(
			middleware.before,
			Object.freeze({
				node: runtime.context.node,
				invocation: runtime.context.invocation,
			})
		),
		onValue: (value) =>
			processBeforeValue({
				runtime,
				middleware,
				nextCursor,
				value,
			}),
		onFailure: (error) => beginError(runtime, failure('thrown', error)),
	});
};

const advanceNode = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>
): EvaluationAdvance<TEffects> =>
	resumeParticipant({
		runtime,
		observed: invokeParticipant(
			runtime.context.executor,
			runtime.context.invocation
		),
		onValue: (value) => processNodeValue(runtime, value),
		onFailure: (error) => beginError(runtime, failure('thrown', error)),
	});

const completeAfter = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	phase: AfterPhase
): EvaluationAdvance<TEffects> => {
	if (phase.failures.length > 0) {
		beginError(runtime, phase.failures[0]!, phase.failures.slice(1));
		return undefined;
	}
	const success: NodeEvaluationSuccess = {
		kind: 'success',
		output: phase.output,
		...(phase.pause ? { pause: phase.pause } : {}),
	};
	if (runtime.context.signal.aborted) {
		beginCancel(runtime, success);
		return undefined;
	}
	return completeSuccess(runtime, success);
};

const advanceAfter = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	phase: AfterPhase
): EvaluationAdvance<TEffects> => {
	while (
		phase.cursor >= 0 &&
		!runtime.entered[phase.cursor]!.middleware.after
	) {
		phase.cursor -= 1;
	}
	if (phase.cursor < 0) {
		return completeAfter(runtime, phase);
	}
	if (runtime.context.signal.aborted) {
		if (phase.failures.length > 0) {
			beginError(runtime, phase.failures[0]!, phase.failures.slice(1));
		} else {
			beginCancel(runtime, cancelledBySignal(runtime.context));
		}
		return undefined;
	}
	const entered = runtime.entered[phase.cursor]!;
	return resumeParticipant({
		runtime,
		observed: invokeParticipant(
			entered.middleware.after!,
			participantOptions(runtime.context, entered, {
				output: phase.output,
			})
		),
		onValue: (value) => processAfterValue({ runtime, phase, value }),
		onFailure: (error) => {
			phase.failures.push(failure('thrown', error));
			phase.cursor -= 1;
		},
	});
};

const advanceError = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	phase: ErrorPhase
): EvaluationAdvance<TEffects> => {
	while (
		phase.cursor >= 0 &&
		!runtime.entered[phase.cursor]!.middleware.error
	) {
		phase.cursor -= 1;
	}
	if (phase.cursor < 0) {
		return completeFailure({
			runtime,
			failureClass: 'graph',
			primary: phase.primary,
			secondary: phase.secondary,
		});
	}
	const entered = runtime.entered[phase.cursor]!;
	return resumeParticipant({
		runtime,
		observed: invokeParticipant(
			entered.middleware.error!,
			participantOptions(runtime.context, entered, {
				error: phase.primary.error,
			})
		),
		onValue: (value) => {
			const invalid = cleanupFailure(runtime.context, 'error', value);
			if (invalid) {
				phase.secondary.push(invalid);
			}
			phase.cursor -= 1;
		},
		onFailure: (error) => {
			phase.secondary.push(failure('thrown', error));
			phase.cursor -= 1;
		},
	});
};

const advanceCancel = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>,
	phase: CancelPhase
): EvaluationAdvance<TEffects> => {
	while (
		phase.cursor >= 0 &&
		!runtime.entered[phase.cursor]!.middleware.cancel
	) {
		phase.cursor -= 1;
	}
	if (phase.cursor < 0) {
		if (phase.failures.length > 0) {
			return completeFailure({
				runtime,
				failureClass: 'cancel',
				primary: phase.failures[0]!,
				secondary: phase.failures.slice(1),
			});
		}
		return 'kind' in phase.clean
			? completeSuccess(runtime, phase.clean)
			: completeCancelled(runtime, phase.clean);
	}
	const entered = runtime.entered[phase.cursor]!;
	return resumeParticipant({
		runtime,
		observed: invokeParticipant(
			entered.middleware.cancel!,
			participantOptions(runtime.context, entered, {
				reason: runtime.context.signal.reason,
			})
		),
		onValue: (value) => {
			const invalid = cleanupFailure(runtime.context, 'cancel', value);
			if (invalid) {
				phase.failures.push(invalid);
			}
			phase.cursor -= 1;
		},
		onFailure: (error) => {
			phase.failures.push(failure('thrown', error));
			phase.cursor -= 1;
		},
	});
};

export const driveEvaluation = <TEffects extends EffectRegistry>(
	runtime: EvaluationRuntime<TEffects>
): MaybePromise<NodeEvaluation<TEffects>> => {
	while (true) {
		const phase = runtime.phase;
		let advanced: EvaluationAdvance<TEffects>;
		switch (phase.kind) {
			case 'before':
				advanced = advanceBefore(runtime, phase);
				break;
			case 'node':
				advanced = advanceNode(runtime);
				break;
			case 'after':
				advanced = advanceAfter(runtime, phase);
				break;
			case 'error':
				advanced = advanceError(runtime, phase);
				break;
			case 'cancel':
				advanced = advanceCancel(runtime, phase);
				break;
		}
		if (advanced) {
			return advanced;
		}
	}
};
