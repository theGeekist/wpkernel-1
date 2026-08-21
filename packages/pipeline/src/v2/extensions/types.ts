import type {
	Edge,
	EffectRegistry,
	Graph,
	GraphContribution,
	GraphDiagnostic,
	GraphValue,
	MaybePromise,
	NodeExecutors,
	NodeKey,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';

/** Immutable declaration fragment returned by one graph extension callback. */
export interface GraphExtensionContribution<
	TNodes extends NodeRegistry = NodeRegistry,
	TEdges extends readonly Edge[] = readonly Edge[],
	TOutputs extends Readonly<Record<string, NodeKey>> = Readonly<
		Record<string, NodeKey>
	>,
> extends Omit<
		GraphContribution,
		| 'registrationOrder'
		| 'contributions'
		| 'nodes'
		| 'edges'
		| 'outputs'
		| 'executors'
	> {
	readonly nodes?: TNodes;
	readonly edges?: TEdges;
	readonly outputs?: TOutputs;
	readonly executors: Readonly<Record<keyof TNodes & NodeKey, unknown>>;
}

/** Configuration-time role that contributes declarations but cannot see runs. */
export interface GraphExtension<
	TConfiguration,
	TContribution extends
		GraphExtensionContribution = GraphExtensionContribution,
> {
	readonly contribute: (options: {
		readonly configuration: TConfiguration;
	}) => MaybePromise<TContribution>;
}

/** One independent extension registration. */
export interface GraphExtensionUseOptions<
	TConfiguration,
	TContribution extends
		GraphExtensionContribution = GraphExtensionContribution,
> {
	readonly extension: GraphExtension<TConfiguration, TContribution>;
	readonly configuration: TConfiguration;
}

type EmptyNodes = Readonly<Record<never, never>>;
type EmptyEdges = readonly [];
type EmptyProjection = Readonly<Record<never, never>>;

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

type CheckedGraphExtensionContribution<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TCapabilities,
	TContribution extends GraphExtensionContribution,
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

/** Original contribution callback failure retained by registration order. */
export interface GraphExtensionFailure {
	readonly registrationOrder: number;
	readonly error: unknown;
}

/** Algebraic result after captured contributions drain and graph compilation runs. */
export type CompileGraphExtensionsResult<
	TInputs extends Readonly<Record<string, GraphValue>> = Readonly<
		Record<string, GraphValue>
	>,
	TNodes extends NodeRegistry = NodeRegistry,
	TEdges extends readonly Edge[] = readonly Edge[],
	TEffects extends EffectRegistry = EffectRegistry,
	TProjection extends OutputProjection<TNodes> = OutputProjection<TNodes>,
	TCapabilities = unknown,
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
	| {
			readonly ok: false;
			readonly kind: 'extension-failed';
			readonly primaryFailure: GraphExtensionFailure;
			readonly failures: readonly GraphExtensionFailure[];
	  }
	| {
			readonly ok: false;
			readonly kind: 'graph-invalid';
			readonly diagnostics: readonly GraphDiagnostic[];
	  };

/** Ordered configuration queue whose compile call captures one stable tail. */
export interface GraphExtensionRegistry<
	TInputs extends Readonly<Record<string, GraphValue>> = Readonly<
		Record<string, GraphValue>
	>,
	TNodes extends NodeRegistry = NodeRegistry,
	TEdges extends readonly Edge[] = readonly Edge[],
	TEffects extends EffectRegistry = EffectRegistry,
	TProjection extends OutputProjection<TNodes> = OutputProjection<TNodes>,
	TCapabilities = unknown,
> {
	readonly use: <
		TConfiguration,
		const TContribution extends GraphExtensionContribution,
	>(options: {
		readonly extension: GraphExtension<
			TConfiguration,
			TContribution &
				CheckedGraphExtensionContribution<
					TInputs,
					TNodes,
					TEdges,
					TEffects,
					TCapabilities,
					NoInfer<TContribution>
				>
		>;
		readonly configuration: TConfiguration;
	}) => GraphExtensionRegistry<
		TInputs,
		AccumulatedNodes<TNodes, TContribution>,
		AccumulatedEdges<TEdges, TContribution>,
		TEffects,
		AccumulatedProjection<TProjection, TContribution> &
			OutputProjection<AccumulatedNodes<TNodes, TContribution>>,
		TCapabilities
	>;
	readonly compile: () =>
		| CompileGraphExtensionsResult<
				TInputs,
				TNodes,
				TEdges,
				TEffects,
				TProjection,
				TCapabilities
		  >
		| Promise<
				CompileGraphExtensionsResult<
					TInputs,
					TNodes,
					TEdges,
					TEffects,
					TProjection,
					TCapabilities
				>
		  >;
}
