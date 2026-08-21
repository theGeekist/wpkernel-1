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
} from '../graph/types.js';
import type { RunObserverFailure } from '../observers/types.js';
import type { PendingPause, RunOutcome } from '../scheduler/types.js';

declare class SuspensionAuthority<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> {
	private readonly suspensionAuthority: {
		readonly nodes: TNodes;
		readonly outputs: TOutputs;
		readonly effects: TEffects;
	};
}

/** Private, process-local, single-use authority with a diagnostic projection. */
export type Suspension<
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
> = SuspensionAuthority<TNodes, TOutputs, TEffects> & {
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
