import type {
	DependencyOutputs,
	Edge,
	EffectKeysOf,
	EffectRegistry,
	EffectRequestsFor,
	ExternalKeysOf,
	GraphValue,
	MaybePromise,
	NodeInvocation,
	NodeKey,
	NodeRegistry,
	OutputOf,
} from '../graph/types.js';

/**
 * Explicit run-local state and declared effect requests from a `before` phase.
 *
 * @public
 */
export interface MiddlewareResult<TState, TRequest> {
	readonly state: TState;
	readonly effects: readonly TRequest[];
}

/** Immutable node identity and invocation shared by middleware phases. @public */
export interface MiddlewareInvocationOptions<TKey, TInvocation> {
	readonly node: TKey;
	readonly invocation: TInvocation;
}

/** Input for phases whose `before` phase completed, including its state. @public */
export interface MiddlewareEnteredOptions<TKey, TInvocation, TState>
	extends MiddlewareInvocationOptions<TKey, TInvocation> {
	readonly state: TState;
}

/**
 * Ordered phases around exactly one node invocation.
 *
 * Middleware has no continuation and cannot admit or suppress other nodes.
 * `before` phases enter in registration order; `after`, `error` and `cancel`
 * unwind entered middleware in reverse order. Each phase remains synchronous
 * until that phase's return exposes a callable `then`.
 *
 * @public
 */
export interface NodeMiddleware<
	TKey extends NodeKey,
	TInvocation,
	TOutput,
	TState,
	TRequest,
> {
	readonly node: TKey;
	readonly before?: (
		options: MiddlewareInvocationOptions<TKey, TInvocation>
	) => MaybePromise<MiddlewareResult<TState, TRequest>>;
	readonly after?: (
		options: MiddlewareEnteredOptions<TKey, TInvocation, TState> & {
			readonly output: TOutput;
		}
	) => MaybePromise<readonly TRequest[]>;
	readonly error?: (
		options: MiddlewareEnteredOptions<TKey, TInvocation, TState> & {
			readonly error: unknown;
		}
	) => MaybePromise<void>;
	readonly cancel?: (
		options: MiddlewareEnteredOptions<TKey, TInvocation, TState> & {
			readonly reason: unknown;
		}
	) => MaybePromise<void>;
}

/** Exact single-node middleware type derived from graph registries and edges. @public */
export type NodeMiddlewareFor<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	K extends keyof TNodes & NodeKey,
	TState,
> = NodeMiddleware<
	K,
	NodeInvocation<
		Readonly<Pick<TInputs, ExternalKeysOf<TNodes[K]> & keyof TInputs>>,
		DependencyOutputs<TNodes, TEdges, K>,
		TCapabilities
	>,
	OutputOf<TNodes[K]>,
	TState,
	EffectRequestsFor<TEffects, EffectKeysOf<TNodes[K]> & keyof TEffects>
>;

type MiddlewareStateOf<TMiddleware> = TMiddleware extends {
	readonly before?: infer TBefore;
}
	? NonNullable<TBefore> extends (...options: never[]) => infer TResult
		? Awaited<TResult> extends MiddlewareResult<infer TState, unknown>
			? TState
			: never
		: undefined
	: undefined;

type CheckedNodeMiddleware<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TMiddleware,
> = TMiddleware extends { readonly node: infer TKey }
	? TKey extends keyof TNodes & NodeKey
		? TMiddleware &
				NodeMiddlewareFor<
					TInputs,
					TNodes,
					TEdges,
					TEffects,
					TCapabilities,
					TKey,
					MiddlewareStateOf<TMiddleware>
				>
		: never
	: never;

/** Exact tuple validation used by the heterogeneous scheduler boundary. @internal */
export type CheckedNodeMiddlewareRegistrations<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TMiddleware extends readonly NodeMiddlewareRegistration[],
> = {
	readonly [TIndex in keyof TMiddleware]: CheckedNodeMiddleware<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TCapabilities,
		TMiddleware[TIndex]
	>;
};

/**
 * Runtime registration shape. Exact state and effect typing is established by
 * {@link NodeMiddlewareFor}; this shape only erases it at the interpreter seam.
 *
 * @internal
 */
export interface NodeMiddlewareRegistration<TKey extends NodeKey = NodeKey> {
	readonly node: TKey;
	readonly before?: (...options: never[]) => unknown;
	readonly after?: (...options: never[]) => unknown;
	readonly error?: (...options: never[]) => unknown;
	readonly cancel?: (...options: never[]) => unknown;
}

/** @internal */
export interface ErasedNodeMiddleware {
	readonly node: string;
	readonly registrationOrder: number;
	readonly before?: (options: unknown) => unknown;
	readonly after?: (options: unknown) => unknown;
	readonly error?: (options: unknown) => unknown;
	readonly cancel?: (options: unknown) => unknown;
}

/** @internal */
export type CompiledNodeMiddleware = ReadonlyMap<
	string,
	readonly ErasedNodeMiddleware[]
>;
