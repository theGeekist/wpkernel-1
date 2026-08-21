import type { ErasedNodeMiddleware } from '../middleware/types.js';
import type {
	EnteredMiddleware,
	EvaluationContext,
	NodeEvaluationFailure,
} from './evaluation-types.js';
import {
	observeParticipant,
	type ObservedParticipant,
} from './maybe-promise.js';

export const freezeArray = <T>(values: readonly T[]): readonly T[] =>
	Object.freeze([...values]);

export const invokeParticipant = <T>(
	participant: (...options: never[]) => unknown,
	options: unknown
): ObservedParticipant<T> => {
	let returned: unknown;
	try {
		returned = Reflect.apply(participant, undefined, [options]);
	} catch (error) {
		return { kind: 'failed', error };
	}
	return observeParticipant<T>(returned);
};

export const enterMiddleware = (
	middleware: ErasedNodeMiddleware,
	state: unknown
): EnteredMiddleware => ({ middleware, state });

export const enteredOptions = (
	context: EvaluationContext,
	entered: EnteredMiddleware
) =>
	Object.freeze({
		node: context.node,
		invocation: context.invocation,
		state: entered.state,
	});

export const evaluationFailure = (
	kind: NodeEvaluationFailure['kind'],
	error: unknown
): NodeEvaluationFailure => Object.freeze({ kind, error });
