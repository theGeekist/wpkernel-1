/**
 * The closed value algebra admitted at graph ownership boundaries.
 *
 * @public
 */
export type GraphScalar = null | undefined | boolean | number | bigint | string;

/** @public */
export type GraphValue =
	| GraphScalar
	| readonly GraphValue[]
	| { readonly [key: string]: GraphValue };

/** @public */
export type MaybePromise<T> = T | PromiseLike<T>;

/** @public */
export type NodeKey = string;

/** @public */
export type EffectKey = string;

declare const nodeType: unique symbol;
declare const effectType: unique symbol;

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

/** @public */
export type NodeRegistry = Readonly<
	Record<NodeKey, NodeContract<string, GraphValue, unknown, EffectKey>>
>;

/** @public */
export interface Edge<
	TFrom extends NodeKey = NodeKey,
	TTo extends NodeKey = NodeKey,
> {
	readonly from: TFrom;
	readonly to: TTo;
}

/** @public */
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

/** @public */
export type EffectRegistry = Readonly<
	Record<EffectKey, EffectContract<GraphValue, unknown, unknown, unknown>>
>;

/** @public */
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

/** @public */
export type OutputOf<T> = NodeTypes<T>['output'];
/** @public */
export type FailureOf<T> = NodeTypes<T>['failure'];
/** @public */
export type ExternalKeysOf<T> = NodeTypes<T>['input'];
/** @public */
export type EffectKeysOf<T> = NodeTypes<T>['effects'];

/** @public */
export type Predecessors<
	TEdges extends readonly Edge[],
	K extends NodeKey,
> = Extract<TEdges[number], { readonly to: K }>['from'];

/** @public */
export type DependencyOutputs<
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	K extends keyof TNodes & NodeKey,
> = {
	readonly [P in Predecessors<TEdges, K> & keyof TNodes]: OutputOf<TNodes[P]>;
};

/** @public */
export type OutputProjection<TNodes extends NodeRegistry> = Readonly<
	Record<string, keyof TNodes & NodeKey>
>;

/** @public */
export type GraphOutputs<
	TNodes extends NodeRegistry,
	TProjection extends OutputProjection<TNodes>,
> = { readonly [K in keyof TProjection]: OutputOf<TNodes[TProjection[K]]> };

/** @public */
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

/** @public */
export type EffectRequestFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects,
> = {
	readonly participant: K;
	readonly payload: EffectTypes<TEffects[K]>['payload'];
};

/** @public */
export type EffectRequestsFor<
	TEffects extends EffectRegistry,
	K extends keyof TEffects,
> = { readonly [P in K]: EffectRequestFor<TEffects, P> }[K];

/** @public */
export type NodeResult<TOutput extends GraphValue, TFailure, TRequest> =
	| {
			readonly kind: 'success';
			readonly output: TOutput;
			readonly effects: readonly TRequest[];
			readonly pause?: { readonly reason?: string };
	  }
	| { readonly kind: 'failure'; readonly error: TFailure }
	| { readonly kind: 'cancelled'; readonly reason?: unknown };

/** @public */
export interface ExecutionPolicy {
	readonly maxConcurrency: number | 'unbounded';
}

/** @public */
export interface NodeInvocation<TExternal, TDependencies, TCapabilities> {
	readonly input: {
		readonly external: TExternal;
		readonly dependencies: TDependencies;
	};
	readonly capabilities: TCapabilities;
	readonly signal: AbortSignal;
}

/** @public */
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
 * Erased extension input until P2-004 provides typed composition.
 *
 * @internal
 */
export interface GraphContribution {
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

/** @public */
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

/** @public */
export interface CompiledGraphNode<TKey extends NodeKey = NodeKey> {
	readonly key: TKey;
	readonly externalInputs: readonly string[];
	readonly effectKeys: readonly string[];
	readonly priority: number;
	readonly registrationOrder: number;
	readonly rank: number;
	readonly ordinal: number;
}

/** @public */
export interface Graph<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
> {
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
	readonly _types?: () => {
		readonly edges: TEdges;
		readonly effects: TEffects;
		readonly capabilities: TCapabilities;
		readonly outputs: GraphOutputs<TNodes, TProjection>;
	};
}

/** @public */
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

/** @public */
export interface GraphDiagnostic {
	readonly code: GraphDiagnosticCode;
	readonly message: string;
	readonly path: readonly string[];
}

/** @public */
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
