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
import type { PendingPause, RunOutcome } from '../scheduler/types.js';
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

/** Public diagnostic projection for private, process-local authority. */
export type Suspension<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = {
	readonly [suspensionBrand]: SuspensionTypeWitness<
		TNodes,
		TOutputs,
		TEffects
	>;
	readonly pause: PendingPause;
	readonly snapshot: RunDiagnostics;
};

/** Complete result of explicitly abandoning one suspension. */
export interface AbandonmentOutcome<TEffects extends EffectRegistry> {
	readonly kind: 'abandoned';
	readonly cleanupFailures: readonly EffectJournalFailure<TEffects>[];
	readonly effectJournal: readonly EffectJournalEntry<TEffects>[];
	readonly observerFailures: readonly RunObserverFailure[];
	readonly diagnostics: RunDiagnostics;
}

/** Options for consuming a suspension by continuing its captured frontier. */
export interface ResumeOptions<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> {
	readonly suspension: Suspension<TNodes, TOutputs, TEffects>;
	readonly signal?: AbortSignal;
}

/** Options for consuming a suspension by compensating its prepared journal. */
export interface AbandonOptions<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> {
	readonly suspension: Suspension<TNodes, TOutputs, TEffects>;
}

/** Exact inferred continuation result. */
export type ResumeResult<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = MaybePromise<RunOutcome<TNodes, TOutputs, TEffects>>;

/** Exact inferred abandonment result. */
export type AbandonResult<TEffects extends EffectRegistry> = MaybePromise<
	AbandonmentOutcome<TEffects>
>;
