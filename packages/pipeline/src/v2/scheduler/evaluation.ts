import type { EffectRegistry, MaybePromise } from '../graph/types.js';
import type { ErasedNodeMiddleware } from '../middleware/types.js';
import type { EffectJournalRuntime } from '../effects/types.js';
import { driveEvaluation } from './evaluation-machine.js';
import type { EvaluationContext, NodeEvaluation } from './evaluation-types.js';
import { freezeArray } from './evaluation-support.js';
import type { ErasedExecutor } from './state.js';

export type {
	NodeEvaluation,
	NodeEvaluationFailure,
} from './evaluation-types.js';

/**
 * Interprets exactly one node plus its statically compiled middleware phases.
 * Readiness, capacity, admission and dependant unlocking remain scheduler-owned.
 *
 * @param options             - Node evaluation options.
 * @param options.node        - Canonical node key.
 * @param options.nodeOrdinal - Canonical graph node ordinal.
 * @param options.effectKeys  - Effect keys permitted for the node.
 * @param options.executor    - Compiled node executor.
 * @param options.invocation  - Immutable node invocation snapshot.
 * @param options.middleware  - Statically compiled middleware for the node.
 * @param options.signal      - Run cancellation signal.
 * @param options.journal     - Process-local effect journal runtime.
 */
export const evaluateNode = <TEffects extends EffectRegistry>(options: {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectKeys: readonly string[];
	readonly executor: ErasedExecutor;
	readonly invocation: EvaluationContext['invocation'];
	readonly middleware: readonly ErasedNodeMiddleware[];
	readonly signal: AbortSignal;
	readonly journal: EffectJournalRuntime<TEffects>;
}): MaybePromise<NodeEvaluation<TEffects>> =>
	driveEvaluation({
		context: Object.freeze({
			...options,
			effectKeys: freezeArray(options.effectKeys),
			middleware: freezeArray(options.middleware),
		}),
		entered: [],
		effects: [],
		nextEffectOrdinal: 0,
		phase: { kind: 'before', cursor: 0 },
	});
