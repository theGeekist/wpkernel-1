import type {
	EffectRegistry,
	GraphValue,
	NodeInvocation,
} from '../graph/types.js';
import type { ErasedNodeMiddleware } from '../middleware/types.js';
import type { ErasedExecutor } from './state.js';
import type { PendingEffect, PendingPause } from './types.js';

export interface NodeEvaluationFailure {
	readonly kind: 'declared' | 'thrown' | 'contract';
	readonly error: unknown;
}

interface EvaluationProjection<TEffects extends EffectRegistry> {
	readonly effects: readonly PendingEffect<TEffects>[];
}

export type NodeEvaluation<TEffects extends EffectRegistry> =
	| (EvaluationProjection<TEffects> & {
			readonly kind: 'success';
			readonly output: GraphValue;
			readonly pause?: PendingPause;
	  })
	| (EvaluationProjection<TEffects> & {
			readonly kind: 'failure';
			readonly failureClass: 'graph' | 'cancel';
			readonly primaryFailure: NodeEvaluationFailure;
			readonly secondaryFailures: readonly NodeEvaluationFailure[];
	  })
	| (EvaluationProjection<TEffects> & {
			readonly kind: 'cancelled';
			readonly reason?: unknown;
	  });

export interface EnteredMiddleware {
	readonly middleware: ErasedNodeMiddleware;
	readonly state: unknown;
}

export interface EvaluationProgress<TEffects extends EffectRegistry> {
	readonly entered: readonly EnteredMiddleware[];
	readonly effects: readonly PendingEffect<TEffects>[];
}

export interface EvaluationContext {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectKeys: readonly string[];
	readonly executor: ErasedExecutor;
	readonly invocation: NodeInvocation<
		Readonly<Record<string, GraphValue>>,
		Readonly<Record<string, GraphValue>>,
		unknown
	>;
	readonly middleware: readonly ErasedNodeMiddleware[];
	readonly signal: AbortSignal;
}

export type CleanCancellation =
	| { readonly reasonPresent: false }
	| { readonly reasonPresent: true; readonly reason: unknown };

export interface NodeEvaluationSuccess {
	readonly kind: 'success';
	readonly output: GraphValue;
	readonly pause?: PendingPause;
}

export type EvaluationPhase =
	| { kind: 'before'; cursor: number }
	| { kind: 'node' }
	| {
			kind: 'after';
			cursor: number;
			readonly output: GraphValue;
			readonly pause?: PendingPause;
			readonly failures: NodeEvaluationFailure[];
	  }
	| {
			kind: 'error';
			cursor: number;
			readonly primary: NodeEvaluationFailure;
			readonly secondary: NodeEvaluationFailure[];
	  }
	| {
			kind: 'cancel';
			cursor: number;
			readonly failures: NodeEvaluationFailure[];
			readonly clean: CleanCancellation | NodeEvaluationSuccess;
	  };

export interface EvaluationRuntime<TEffects extends EffectRegistry> {
	readonly context: EvaluationContext;
	readonly entered: EnteredMiddleware[];
	readonly effects: PendingEffect<TEffects>[];
	phase: EvaluationPhase;
}
