import type {
	Edge,
	EffectRegistry,
	ErasedGraph,
	ErasedGraphDeclaration,
	GraphContribution,
	GraphDiagnostic,
	GraphValue,
	MaybePromise,
	NodeExecutors,
	NodeKey,
	NodeRegistry,
	OutputProjection,
	RegisteredGraphContribution,
} from '../graph/types.js';

export type { GraphContribution } from '../graph/types.js';

type ImmutableGraphValue<TValue extends GraphValue> = TValue extends
	| null
	| undefined
	| boolean
	| number
	| bigint
	| string
	? TValue
	: TValue extends readonly GraphValue[]
		? {
				readonly [TKey in keyof TValue]: TValue[TKey] extends GraphValue
					? ImmutableGraphValue<TValue[TKey]>
					: never;
			}
		: TValue extends Readonly<Record<string, GraphValue>>
			? { readonly [K in keyof TValue]: ImmutableGraphValue<TValue[K]> }
			: never;

/**
 * Configuration-time role that contributes declarations but cannot see runs.
 *
 * Configuration is validated, copied and recursively frozen before invocation.
 * The callback runs exactly once in registration order and cannot register more
 * work re-entrantly.
 *
 * @public
 */
export interface GraphExtension<
	TConfiguration extends GraphValue,
	TContribution extends GraphContribution = GraphContribution,
> {
	readonly contribute: (options: {
		readonly configuration: ImmutableGraphValue<TConfiguration>;
	}) => MaybePromise<TContribution>;
}

/**
 * One immutable extension registration in a Pipeline configuration.
 *
 * @public
 */
export interface GraphExtensionRegistration<
	TConfiguration extends GraphValue = GraphValue,
	TContribution extends GraphContribution = GraphContribution,
> {
	readonly extension: GraphExtension<TConfiguration, TContribution>;
	readonly configuration: TConfiguration;
}

/** Structural tuple constraint; exact extension types are checked separately. @internal */
export interface GraphExtensionRegistrationShape {
	readonly extension: Readonly<Record<'contribute', unknown>>;
	readonly configuration: GraphValue;
}

type EmptyNodes = Readonly<Record<never, never>>;
type EmptyEdges = readonly [];
type EmptyProjection = Readonly<Record<never, never>>;

type ContributionOf<TRegistration> = TRegistration extends {
	readonly extension: {
		readonly contribute: (options: infer _TOptions) => infer TResult;
	};
}
	? Awaited<TResult> extends GraphContribution
		? Awaited<TResult>
		: never
	: never;

type ConfigurationOf<TRegistration> = TRegistration extends {
	readonly configuration: infer TConfiguration extends GraphValue;
}
	? TConfiguration
	: never;

type ContributionNodes<TContribution> = TContribution extends {
	readonly nodes: infer TNodes extends NodeRegistry;
}
	? TNodes
	: EmptyNodes;

type ContributionEdges<TContribution> = TContribution extends {
	readonly edges: infer TEdges extends readonly Edge[];
}
	? TEdges
	: EmptyEdges;

type ContributionOutputs<TContribution> = TContribution extends {
	readonly outputs: infer TOutputs extends Readonly<Record<string, NodeKey>>;
}
	? TOutputs
	: EmptyProjection;

type AccumulatedNodes<TNodes extends NodeRegistry, TContribution> = Readonly<
	TNodes & ContributionNodes<TContribution>
>;

type AccumulatedEdges<
	TEdges extends readonly Edge[],
	TContribution,
> = readonly [...TEdges, ...ContributionEdges<TContribution>];

type AccumulatedProjection<TProjection, TContribution> = Readonly<
	Omit<TProjection, keyof ContributionOutputs<TContribution>> &
		ContributionOutputs<TContribution>
>;

type ContributionExecutors<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TContribution,
> = Readonly<{
	[TKey in keyof ContributionNodes<TContribution> & NodeKey]: NodeExecutors<
		TInputs,
		AccumulatedNodes<TNodes, TContribution>,
		AccumulatedEdges<TEdges, TContribution>,
		TEffects,
		TCapabilities
	>[TKey];
}>;

type CheckedGraphContribution<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TContribution extends GraphContribution,
> = TContribution & {
	readonly outputs?: ContributionOutputs<TContribution> &
		OutputProjection<AccumulatedNodes<TNodes, TContribution>>;
	readonly anchors?: Readonly<
		Record<string, keyof AccumulatedNodes<TNodes, TContribution> & NodeKey>
	>;
	readonly executors: ContributionExecutors<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TCapabilities,
		TContribution
	>;
};

type CheckedGraphExtensionRegistration<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TRegistration extends GraphExtensionRegistrationShape,
> = TRegistration & {
	readonly extension: GraphExtension<
		ConfigurationOf<TRegistration>,
		ContributionOf<TRegistration> &
			CheckedGraphContribution<
				TInputs,
				TNodes,
				TEdges,
				TEffects,
				TCapabilities,
				ContributionOf<TRegistration>
			>
	>;
};

/** Exact sequential validation for a heterogeneous extension tuple. @internal */
export type CheckedGraphExtensionRegistrations<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TRegistrations extends readonly GraphExtensionRegistrationShape[],
> = TRegistrations extends readonly [
	infer TFirst extends GraphExtensionRegistrationShape,
	...infer TRest extends readonly GraphExtensionRegistrationShape[],
]
	? readonly [
			CheckedGraphExtensionRegistration<
				TInputs,
				TNodes,
				TEdges,
				TEffects,
				TCapabilities,
				TFirst
			>,
			...CheckedGraphExtensionRegistrations<
				TInputs,
				AccumulatedNodes<TNodes, ContributionOf<TFirst>>,
				AccumulatedEdges<TEdges, ContributionOf<TFirst>>,
				TEffects,
				TCapabilities,
				TRest
			>,
		]
	: readonly [];

/** Final node registry after applying one extension tuple in order. @internal */
export type ExtensionNodes<
	TNodes extends NodeRegistry,
	TRegistrations extends readonly GraphExtensionRegistrationShape[],
> = TRegistrations extends readonly [
	infer TFirst extends GraphExtensionRegistrationShape,
	...infer TRest extends readonly GraphExtensionRegistrationShape[],
]
	? ExtensionNodes<AccumulatedNodes<TNodes, ContributionOf<TFirst>>, TRest>
	: TNodes;

/** Final edge tuple after applying one extension tuple in order. @internal */
export type ExtensionEdges<
	TEdges extends readonly Edge[],
	TRegistrations extends readonly GraphExtensionRegistrationShape[],
> = TRegistrations extends readonly [
	infer TFirst extends GraphExtensionRegistrationShape,
	...infer TRest extends readonly GraphExtensionRegistrationShape[],
]
	? ExtensionEdges<AccumulatedEdges<TEdges, ContributionOf<TFirst>>, TRest>
	: TEdges;

/** Final output projection after applying one extension tuple in order. @internal */
export type ExtensionProjection<
	TProjection,
	TRegistrations extends readonly GraphExtensionRegistrationShape[],
> = TRegistrations extends readonly [
	infer TFirst extends GraphExtensionRegistrationShape,
	...infer TRest extends readonly GraphExtensionRegistrationShape[],
]
	? ExtensionProjection<
			AccumulatedProjection<TProjection, ContributionOf<TFirst>>,
			TRest
		>
	: TProjection;

/**
 * Original contribution callback failure retained by registration order.
 * The error is evidence, not replaced by a compiler wrapper.
 *
 * @public
 */
export interface GraphExtensionFailure {
	readonly registrationOrder: number;
	readonly error: unknown;
}

/** @internal */
export type ExtensionSettlement =
	| {
			readonly kind: 'succeeded';
			readonly contribution: RegisteredGraphContribution;
	  }
	| { readonly kind: 'failed'; readonly failure: GraphExtensionFailure };

/** Explicit interpreter-owned settlement cell. @internal */
export interface ExtensionSettlementCell {
	settlement: ExtensionSettlement | Promise<ExtensionSettlement>;
}

/** Static graph identities recoverable before complete graph validation. @internal */
export interface GraphConfigurationSurface {
	readonly nodeKeys: readonly string[];
	readonly effectKeys: readonly string[];
}

/** Immutable captured extension generation used by Pipeline. @internal */
export interface GraphExtensionGeneration {
	readonly declaration: ErasedGraphDeclaration;
	readonly settlements: readonly ExtensionSettlementCell[];
}

/** Complete internal compilation evidence for one captured generation. */
export type GraphExtensionCompilation =
	| {
			readonly kind: 'compiled';
			readonly extensionFailures: readonly GraphExtensionFailure[];
			readonly graphDiagnostics: readonly [];
			readonly configurationSurface: GraphConfigurationSurface;
			readonly graph: ErasedGraph;
	  }
	| {
			readonly kind: 'invalid';
			readonly extensionFailures: readonly GraphExtensionFailure[];
			readonly graphDiagnostics: readonly GraphDiagnostic[];
			readonly configurationSurface: GraphConfigurationSurface;
			readonly graph?: never;
	  };
