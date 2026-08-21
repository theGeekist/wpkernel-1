import type {
	EffectContract,
	EffectRegistry,
	EffectTypes,
	GraphValue,
	MaybePromise,
} from '../graph/types.js';
import type { ObserverDispatcher } from '../observers/types.js';
import type { PendingEffect } from '../scheduler/types.js';

/** Explicit success or declared failure returned by one effect phase. */
export type EffectPhaseResult<TValue, TFailure> =
	| { readonly kind: 'success'; readonly value: TValue }
	| { readonly kind: 'failure'; readonly error: TFailure };

/** Process-local participant for one heterogeneous effect contract. */
export interface EffectParticipant<
	TContract extends EffectContract<GraphValue, unknown, unknown, unknown>,
> {
	readonly prepare: (options: {
		readonly payload: EffectTypes<TContract>['payload'];
		readonly signal: AbortSignal;
	}) => MaybePromise<
		EffectPhaseResult<
			EffectTypes<TContract>['prepared'],
			EffectTypes<TContract>['failure']
		>
	>;
	readonly commit: (options: {
		readonly prepared: EffectTypes<TContract>['prepared'];
		readonly signal: AbortSignal;
	}) => MaybePromise<
		EffectPhaseResult<
			EffectTypes<TContract>['receipt'],
			EffectTypes<TContract>['failure']
		>
	>;
	readonly compensate: (options: {
		readonly prepared: EffectTypes<TContract>['prepared'];
		readonly receipt?: EffectTypes<TContract>['receipt'];
	}) => MaybePromise<
		EffectPhaseResult<void, EffectTypes<TContract>['failure']>
	>;
}

type EmptyEffectParticipants = Readonly<Record<PropertyKey, never>>;

/** Exact literal-keyed runtime authority for a graph's effect contracts. */
export type EffectParticipants<TEffects extends EffectRegistry> =
	keyof TEffects extends never
		? EmptyEffectParticipants
		: {
				readonly [K in keyof TEffects]: EffectParticipant<TEffects[K]>;
			};

/** One effect participant phase. */
export type EffectPhase = 'prepare' | 'commit' | 'compensate';

interface EffectFailureIdentity<K extends string> {
	readonly participant: K;
	readonly phase: EffectPhase;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinal: number;
}

type EffectFailureFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects & string,
> = EffectFailureIdentity<K> &
	(
		| {
				readonly kind: 'declared';
				readonly error: EffectTypes<TEffects[K]>['failure'];
		  }
		| { readonly kind: 'thrown'; readonly error: unknown }
	);

/** Typed, immutable record of a contained participant failure. */
export type EffectJournalFailure<TEffects extends EffectRegistry> = {
	readonly [K in keyof TEffects & string]: EffectFailureFor<TEffects, K>;
}[keyof TEffects & string];

/** Immutable public projection of one successfully prepared journal entry. */
export interface EffectJournalEntry<TEffects extends EffectRegistry> {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinal: number;
	readonly request: PendingEffect<TEffects>['request'];
	readonly commit: 'not-attempted' | 'succeeded' | 'failed';
	readonly compensation: 'not-attempted' | 'succeeded' | 'failed';
}

/** @internal */
export interface ErasedEffectParticipant {
	readonly prepare: (options: unknown) => unknown;
	readonly commit: (options: unknown) => unknown;
	readonly compensate: (options: unknown) => unknown;
}

/** @internal */
export type CompiledEffectParticipants = Readonly<
	Record<string, ErasedEffectParticipant>
>;

/** @internal */
export interface JournalOwnedEntry<TEffects extends EffectRegistry> {
	readonly effect: PendingEffect<TEffects>;
	readonly prepared: unknown;
	readonly receiptPresent: boolean;
	readonly receipt?: unknown;
	readonly commit: EffectJournalEntry<TEffects>['commit'];
	readonly compensation: EffectJournalEntry<TEffects>['compensation'];
}

/** @internal */
export type JournalSettlement<TEffects extends EffectRegistry> =
	| { readonly kind: 'committed' }
	| {
			readonly kind: 'compensated';
			readonly trigger: 'graph' | 'cancel' | 'commit' | 'abandon';
			readonly triggerFailure?: EffectJournalFailure<TEffects>;
	  };

/** @internal */
export interface JournalSettlementJoin<TEffects extends EffectRegistry> {
	readonly promise: Promise<JournalSettlement<TEffects>>;
	readonly resolve: (settlement: JournalSettlement<TEffects>) => void;
	readonly reject: (error: unknown) => void;
}

/** @internal */
export interface ActiveJournalSettlement<TEffects extends EffectRegistry> {
	readonly kind: 'active';
	readonly intent: 'commit' | 'compensate';
	phase?: Readonly<{
		readonly kind: 'commit' | 'compensate';
		readonly nodeOrdinal: number;
		readonly effectOrdinal: number;
	}>;
	promise?: Promise<JournalSettlement<TEffects>>;
	join?: JournalSettlementJoin<TEffects>;
}

/** @internal */
export type JournalSettlementAuthority<TEffects extends EffectRegistry> =
	| { readonly kind: 'idle' }
	| ActiveJournalSettlement<TEffects>
	| {
			readonly kind: 'settled';
			readonly settlement: JournalSettlement<TEffects>;
	  }
	| { readonly kind: 'failed'; readonly error: unknown };

/** Explicit mutable process-local interpreter state. @internal */
export interface EffectJournalRuntime<TEffects extends EffectRegistry> {
	readonly participants: CompiledEffectParticipants;
	readonly observers: ObserverDispatcher;
	readonly entries: Map<string, JournalOwnedEntry<TEffects>>;
	readonly failures: EffectJournalFailure<TEffects>[];
	settlement: JournalSettlementAuthority<TEffects>;
}

/** @internal */
export type EffectStepResult<TEffects extends EffectRegistry> =
	| { readonly ok: true }
	| {
			readonly ok: false;
			readonly failure: EffectJournalFailure<TEffects>;
	  };
