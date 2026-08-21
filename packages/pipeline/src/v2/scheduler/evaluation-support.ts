import type { ErasedNodeMiddleware } from '../middleware/types.js';
import type {
	EnteredMiddleware,
	EvaluationContext,
	NodeEvaluationFailure,
} from './evaluation-types.js';
import type { EffectRegistry } from '../graph/types.js';
import { invokeParticipant } from './maybe-promise.js';

export const freezeArray = <T>(values: readonly T[]): readonly T[] =>
	Object.freeze([...values]);

export { invokeParticipant };

export const enterMiddleware = (
	middleware: ErasedNodeMiddleware,
	state: unknown
): EnteredMiddleware => ({ middleware, state });

export const enteredOptions = <TEffects extends EffectRegistry>(
	context: EvaluationContext<TEffects>,
	entered: EnteredMiddleware
) =>
	Object.freeze({
		node: context.node,
		invocation: context.invocation,
		state: entered.state,
	});

export const evaluationFailure = <K extends NodeEvaluationFailure['kind']>(
	kind: K,
	error: Extract<NodeEvaluationFailure, { readonly kind: K }>['error']
): Extract<NodeEvaluationFailure, { readonly kind: K }> =>
	Object.freeze({ kind, error }) as Extract<
		NodeEvaluationFailure,
		{ readonly kind: K }
	>;
