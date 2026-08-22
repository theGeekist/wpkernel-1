import type { RunDiagnostics } from '../diagnostics/types.js';
import type {
	EffectJournalEntry,
	EffectJournalFailure,
} from '../effects/types.js';
import type {
	EffectRegistry,
	GraphValue,
	MaybePromise,
	NodeRegistry,
	NodeTypes,
} from '../graph/types.js';
import type { RunObserverFailure } from '../observers/types.js';
import type { PauseRecord, RunOutcome } from '../scheduler/types.js';
import type { suspensionBrand } from './brand.js';

interface SuspensionTypeWitness<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> {
	readonly nodes: InvariantTypeCell<NodeRegistryTypeWitness<TNodes>>;
	readonly outputs: InvariantTypeCell<TOutputs>;
	readonly effects: InvariantTypeCell<TEffects>;
}

interface InvariantTypeCell<in out T> {
	readonly value: T | undefined;
}

type NodeRegistryTypeWitness<TNodes> = {
	readonly [K in keyof TNodes]: NodeTypes<TNodes[K]>;
};

/**
 * Live, single-use process-local authority over one drained graph frontier.
 *
 * The public pause and snapshot fields are diagnostic projections. Continuation
 * authority remains private, cannot be copied or serialised, and does not
 * survive process death. The host must retain and consume the original token.
 *
 * @public
 */
export type Suspension<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = {
	/** @hidden */
	readonly [suspensionBrand]: SuspensionTypeWitness<
		TNodes,
		TOutputs,
		TEffects
	>;
	readonly pause: PauseRecord;
	readonly snapshot: RunDiagnostics;
};

/**
 * Complete result of explicitly abandoning one suspension.
 * Cleanup runs in reverse logical journal order and retains every failure.
 *
 * @public
 */
export interface AbandonmentOutcome<TEffects extends EffectRegistry> {
	readonly kind: 'abandoned';
	readonly cleanupFailures: readonly EffectJournalFailure<TEffects>[];
	readonly effectJournal: readonly EffectJournalEntry<TEffects>[];
	readonly observerFailures: readonly RunObserverFailure[];
	readonly diagnostics: RunDiagnostics;
}

/**
 * Options for consuming a suspension by continuing its captured frontier.
 * A supplied signal becomes the sole signal for the resumed segment.
 *
 * @public
 */
export interface ResumeOptions<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> {
	readonly suspension: Suspension<TNodes, TOutputs, TEffects>;
	readonly signal?: AbortSignal;
}

/** Options for consuming a suspension by compensating its prepared journal. @public */
export interface AbandonOptions<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> {
	readonly suspension: Suspension<TNodes, TOutputs, TEffects>;
}

/**
 * Exact continuation result, promoted only by asynchronous resumed work or
 * terminal observer delivery.
 *
 * @public
 */
export type ResumeResult<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = MaybePromise<RunOutcome<TNodes, TOutputs, TEffects>>;

/**
 * Exact abandonment result, promoted only by asynchronous compensation or
 * terminal observer delivery.
 *
 * @public
 */
export type AbandonResult<TEffects extends EffectRegistry> = MaybePromise<
	AbandonmentOutcome<TEffects>
>;
