import type { compiledGraphBrand } from './brand.js';

/**
 * Scalar leaf values in the {@link GraphValue} algebra.
 *
 * @public
 */
export type GraphScalar = null | undefined | boolean | number | bigint | string;

/**
 * The closed, acyclic value algebra admitted at graph ownership boundaries.
 *
 * Graph values contain only scalar leaves, plain recursive arrays and plain
 * string-keyed records. At every ownership boundary Pipeline validates the
 * complete value, deep-copies it and recursively freezes the scheduler-owned
 * copy. Caller aliases are never retained as graph data.
 *
 * @public
 */
export type GraphValue =
	| GraphScalar
	| readonly GraphValue[]
	| { readonly [key: string]: GraphValue };

/**
 * A value that settles now unless its return exposes a callable `then`.
 *
 * All structurally valid thenables are adopted; no eager Promise wrapping is
 * implied by this type.
 *
 * @public
 */
export type MaybePromise<T> = T | PromiseLike<T>;

/** Stable identity of one independently scheduled node. @public */
export type NodeKey = string;

/** Stable identity of one declared effect participant. @public */
export type EffectKey = string;

declare const nodeType: unique symbol;
declare const effectType: unique symbol;

/**
 * Static provenance installed on compiled graphs.
 *
 * The private symbol names a real non-enumerable, data-only witness. It keeps
 * literals out of the public type and carries erased generic relationships
 * without a callable phantom. Runtime authority remains in module-owned weak
 * storage and is neither serialised nor recoverable from this witness.
 */
interface CompiledGraphTypeWitness<
	TInputs,
	TNodes,
	TEdges,
	TEffects,
	TProjection,
	TCapabilities,
> {
	readonly inputs: InvariantTypeCell<TInputs>;
	readonly nodes: InvariantTypeCell<NodeRegistryTypeWitness<TNodes>>;
	readonly edges: InvariantTypeCell<TEdges>;
	readonly effects: InvariantTypeCell<TEffects>;
	readonly outputs: InvariantTypeCell<TProjection>;
	readonly capabilities: InvariantTypeCell<TCapabilities>;
}

interface InvariantTypeCell<in out T> {
	readonly value: T | undefined;
}

type NodeRegistryTypeWitness<TNodes> = {
	readonly [K in keyof TNodes]: NodeTypes<TNodes[K]>;
};

/**
 * The static, literal-keyed contract of a graph node.
 *
 * `effectKeys` is required runtime metadata. It permits the compiler to verify
 * every admitted effect key while retaining the member-specific literal union.
 *
 * @public
 */
export interface NodeContract<
	TExternalKeys extends string,
	TOutput extends GraphValue,
	TFailure = unknown,
	TEffectKeys extends EffectKey = never,
> {
	readonly externalInputs: readonly TExternalKeys[];
	readonly priority: number;
	readonly effectKeys: readonly TEffectKeys[];
	readonly [nodeType]?: () => {
		readonly output: TOutput;
		readonly failure: TFailure;
	};
}

/** Literal-keyed registry retaining each node's distinct contract. @public */
export type NodeRegistry = Readonly<
	Record<NodeKey, NodeContract<string, GraphValue, unknown, EffectKey>>
>;

/** A directed data dependency from one node output to another node input. @public */
export interface Edge<
	TFrom extends NodeKey = NodeKey,
	TTo extends NodeKey = NodeKey,
> {
	readonly from: TFrom;
	readonly to: TTo;
}

/** Static payload, prepared-state, receipt and failure types for one effect. @public */
export interface EffectContract<
	TPayload extends GraphValue,
	TPrepared,
	TReceipt,
	TFailure,
> {
	readonly [effectType]?: () => {
		readonly payload: TPayload;
		readonly prepared: TPrepared;
		readonly receipt: TReceipt;
		readonly failure: TFailure;
	};
}

/** Literal-keyed registry retaining each participant's distinct types. @public */
export type EffectRegistry = Readonly<
	Record<EffectKey, EffectContract<GraphValue, unknown, unknown, unknown>>
>;

/** Extracts the four member-specific type families from a node contract. @public */
export type NodeTypes<T> =
	T extends NodeContract<
		infer TInput,
		infer TOutput,
		infer TFailure,
		infer TEffects
	>
		? {
				readonly input: TInput;
				readonly output: TOutput;
				readonly failure: TFailure;
				readonly effects: TEffects;
			}
		: never;

/** Extracts a node contract's output type. @public */
export type OutputOf<T> = NodeTypes<T>['output'];
/** Extracts a node contract's declared failure type. @public */
export type FailureOf<T> = NodeTypes<T>['failure'];
/** Extracts a node contract's external-input key union. @public */
export type ExternalKeysOf<T> = NodeTypes<T>['input'];
/** Extracts a node contract's admitted effect-key union. @public */
export type EffectKeysOf<T> = NodeTypes<T>['effects'];

/** Source keys of edges whose target is `K`. @public */
export type Predecessors<
	TEdges extends readonly Edge[],
	K extends NodeKey,
> = Extract<TEdges[number], { readonly to: K }>['from'];

/** Direct predecessor outputs keyed by their node identities. @public */
export type DependencyOutputs<
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	K extends keyof TNodes & NodeKey,
> = {
	readonly [P in Predecessors<TEdges, K> & keyof TNodes]: OutputOf<TNodes[P]>;
};

/** Named graph outputs mapped to existing node identities. @public */
export type OutputProjection<TNodes extends NodeRegistry> = Readonly<
	Record<string, keyof TNodes & NodeKey>
>;

/** Resolves a projection to its exact named output value types. @public */
export type GraphOutputs<
	TNodes extends NodeRegistry,
	TProjection extends OutputProjection<TNodes>,
> = { readonly [K in keyof TProjection]: OutputOf<TNodes[TProjection[K]]> };

/** Extracts the four member-specific type families from an effect contract. @public */
export type EffectTypes<T> =
	T extends EffectContract<
		infer TPayload,
		infer TPrepared,
		infer TReceipt,
		infer TFailure
	>
		? {
				readonly payload: TPayload;
				readonly prepared: TPrepared;
				readonly receipt: TReceipt;
				readonly failure: TFailure;
			}
		: never;

/** One payload request for the literal participant `K`. @public */
export type EffectRequestFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects,
> = {
	readonly participant: K;
	readonly payload: EffectTypes<TEffects[K]>['payload'];
};

/** Union of requests admitted for a node's declared participant keys. @public */
export type EffectRequestsFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects,
> = { readonly [P in K]: EffectRequestFor<TEffects, P> }[K];

/** Immutable effect request union for one literal participant registry. @public */
export type EffectRequest<TEffects extends EffectRegistry> = {
	readonly [K in keyof TEffects]: EffectRequestFor<TEffects, K>;
}[keyof TEffects];

/**
 * A successful node's request to stop new admission after admitted work drains.
 * Concurrent pause requests fail the run; this is not a durable checkpoint.
 * @public
 */
export interface PauseRequest {
	readonly reason?: string;
}

/** Algebraic node settlement: success, declared failure or cancellation. @public */
export type NodeResult<TOutput extends GraphValue, TFailure, TRequest> =
	| {
			readonly kind: 'success';
			readonly output: TOutput;
			readonly effects: readonly TRequest[];
			readonly pause?: PauseRequest;
	  }
	| { readonly kind: 'failure'; readonly error: TFailure }
	| { readonly kind: 'cancelled'; readonly reason?: unknown };

/** Required graph admission policy; concurrency is positive-safe or unbounded. @public */
export interface ExecutionPolicy {
	readonly maxConcurrency: number | 'unbounded';
}

/** Immutable data, capabilities and cooperative signal supplied to one node. @public */
export interface NodeInvocation<TExternal, TDependencies, TCapabilities> {
	readonly input: {
		readonly external: TExternal;
		readonly dependencies: TDependencies;
	};
	readonly capabilities: TCapabilities;
	readonly signal: AbortSignal;
}

/** Exact literal-keyed executor table derived from nodes, edges and effects. @public */
export type NodeExecutors<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
> = {
	readonly [K in keyof TNodes & NodeKey]: (
		options: NodeInvocation<
			Readonly<Pick<TInputs, ExternalKeysOf<TNodes[K]> & keyof TInputs>>,
			DependencyOutputs<TNodes, TEdges, K>,
			TCapabilities
		>
	) => MaybePromise<
		NodeResult<
			OutputOf<TNodes[K]>,
			FailureOf<TNodes[K]>,
			EffectRequestsFor<
				TEffects,
				EffectKeysOf<TNodes[K]> & keyof TEffects
			>
		>
	>;
};

/**
 * Immutable authoring data. Input keys declare shape only: admitted input
 * values are run-owned and are never embedded in this declaration or graph.
 *
 * @public
 */
export interface GraphDeclaration<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
> {
	readonly inputKeys: readonly (keyof TInputs & string)[];
	readonly nodes: TNodes;
	readonly edges: TEdges;
	readonly effects: TEffects;
	readonly outputs: TProjection;
	readonly policy: ExecutionPolicy;
	readonly executors: NodeExecutors<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TCapabilities
	>;
	readonly anchors?: Readonly<Record<string, keyof TNodes & NodeKey>>;
}

/**
 * Immutable graph authoring fragment returned by one extension callback.
 * Anchors are inert references; they carry no scheduling authority.
 * @public
 */
export interface GraphContribution<
	TNodes extends NodeRegistry = NodeRegistry,
	TEdges extends readonly Edge[] = readonly Edge[],
	TOutputs extends Readonly<Record<string, NodeKey>> = Readonly<
		Record<string, NodeKey>
	>,
> {
	readonly nodes?: TNodes;
	readonly edges?: TEdges;
	readonly anchors?: Readonly<Record<string, NodeKey>>;
	readonly outputs?: TOutputs;
	readonly executors: Readonly<Record<keyof TNodes & NodeKey, unknown>>;
}

/** Scheduler-independent owned contribution with canonical registration order. */
export interface RegisteredGraphContribution {
	readonly registrationOrder: number;
	readonly nodes?: Readonly<
		Record<NodeKey, NodeContract<string, GraphValue, unknown, EffectKey>>
	>;
	readonly edges?: readonly Edge[];
	readonly anchors?: Readonly<Record<string, NodeKey>>;
	readonly outputs?: Readonly<Record<string, NodeKey>>;
	readonly executors: Readonly<Record<string, unknown>>;
	readonly contributions?: never;
}

/**
 * Honest result type for dynamic composition before P2-004.
 *
 * @internal
 */
export type ErasedGraph = Graph<
	Readonly<Record<string, GraphValue>>,
	NodeRegistry,
	readonly Edge[],
	EffectRegistry,
	OutputProjection<NodeRegistry>,
	unknown
>;

/** @internal */
export type ErasedGraphDeclaration = GraphDeclaration<
	Readonly<Record<string, GraphValue>>,
	NodeRegistry,
	readonly Edge[],
	EffectRegistry,
	OutputProjection<NodeRegistry>,
	unknown
>;

/** @internal */
export type ErasedCompileGraphResult =
	| { readonly ok: true; readonly graph: ErasedGraph }
	| { readonly ok: false; readonly diagnostics: readonly GraphDiagnostic[] };

/** @internal */
export interface CompileGraphOptions<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
> {
	readonly declaration: GraphDeclaration<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
}

/** @internal */
export interface CompiledGraphNode<TKey extends NodeKey = NodeKey> {
	readonly key: TKey;
	readonly externalInputs: readonly string[];
	readonly effectKeys: readonly string[];
	readonly priority: number;
	readonly registrationOrder: number;
	readonly rank: number;
	readonly ordinal: number;
}

/** Scheduler-owned compiled graph authority. @internal */
export interface Graph<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
> {
	readonly [compiledGraphBrand]: CompiledGraphTypeWitness<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
	readonly kind: 'graph';
	readonly inputKeys: readonly (keyof TInputs & string)[];
	readonly nodes: Readonly<{
		[K in keyof TNodes & NodeKey]: CompiledGraphNode<K>;
	}>;
	readonly edges: readonly Edge[];
	readonly incoming: Readonly<Record<NodeKey, readonly NodeKey[]>>;
	readonly outgoing: Readonly<Record<NodeKey, readonly NodeKey[]>>;
	readonly ranks: Readonly<Record<NodeKey, number>>;
	readonly ordinals: Readonly<Record<NodeKey, number>>;
	readonly outputs: TProjection;
	readonly anchors: Readonly<Record<string, NodeKey>>;
	readonly policy: Readonly<ExecutionPolicy>;
}

/** Stable category of one canonical graph compilation diagnostic. @public */
export type GraphDiagnosticCode =
	| 'duplicate-node'
	| 'missing-node'
	| 'cycle'
	| 'blocked-by-cycle'
	| 'invalid-input'
	| 'invalid-effect'
	| 'invalid-output'
	| 'invalid-anchor'
	| 'invalid-policy'
	| 'invalid-node'
	| 'invalid-contribution'
	| 'reentrant-contribution';

/** Immutable graph compilation issue with a stable code and structural path. @public */
export interface GraphDiagnostic {
	readonly code: GraphDiagnosticCode;
	readonly message: string;
	readonly path: readonly string[];
}

/** @internal */
export type CompileGraphResult<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
> =
	| {
			readonly ok: true;
			readonly graph: Graph<
				TInputs,
				TNodes,
				TEdges,
				TEffects,
				TProjection,
				TCapabilities
			>;
	  }
	| { readonly ok: false; readonly diagnostics: readonly GraphDiagnostic[] };
