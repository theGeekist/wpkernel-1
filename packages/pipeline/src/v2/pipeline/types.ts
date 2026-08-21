import type { EffectParticipants } from '../effects/types.js';
import type {
	CheckedGraphExtensionRegistrations,
	ExtensionEdges,
	ExtensionNodes,
	ExtensionProjection,
	GraphExtensionFailure,
	GraphExtensionRegistrationShape,
} from '../extensions/types.js';
import type {
	Edge,
	EffectRegistry,
	GraphDeclaration,
	GraphDiagnostic,
	GraphOutputs,
	GraphValue,
	MaybePromise,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';
import type {
	CheckedNodeMiddlewareRegistrations,
	NodeMiddlewareRegistration,
} from '../middleware/types.js';
import type { RunObserver } from '../observers/types.js';
import type { GraphSchedulerError } from '../scheduler/errors.js';
import type { RunOutcome } from '../scheduler/types.js';
import type { pipelineBrand } from './brand.js';

interface InvariantTypeCell<in out T> {
	readonly value: T | undefined;
}

interface PipelineTypeWitness<
	TInputs,
	TNodes,
	TEdges,
	TEffects,
	TProjection,
	TCapabilities,
> {
	readonly inputs: InvariantTypeCell<TInputs>;
	readonly nodes: InvariantTypeCell<TNodes>;
	readonly edges: InvariantTypeCell<TEdges>;
	readonly effects: InvariantTypeCell<TEffects>;
	readonly outputs: InvariantTypeCell<TProjection>;
	readonly capabilities: InvariantTypeCell<TCapabilities>;
}

/** Immutable nominal token for one configured process-local evaluator. */
export interface Pipeline<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection,
	TCapabilities,
> {
	readonly [pipelineBrand]: PipelineTypeWitness<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
	readonly kind: 'pipeline';
}

/** Complete immutable configuration captured by createPipeline. */
export interface CreatePipelineOptions<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	TExtensions extends readonly GraphExtensionRegistrationShape[],
	TParticipants extends Readonly<Record<PropertyKey, unknown>>,
	TMiddleware extends readonly NodeMiddlewareRegistration[],
> {
	readonly declaration: GraphDeclaration<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
	readonly extensions?: TExtensions &
		CheckedGraphExtensionRegistrations<
			TInputs,
			TNodes,
			TEdges,
			TEffects,
			TCapabilities,
			NoInfer<TExtensions>
		>;
	readonly middleware?: TMiddleware &
		CheckedNodeMiddlewareRegistrations<
			TInputs,
			ExtensionNodes<TNodes, TExtensions>,
			ExtensionEdges<TEdges, TExtensions>,
			TEffects,
			TCapabilities,
			NoInfer<TMiddleware>
		>;
	readonly observers?: readonly RunObserver[];
	readonly participants: TParticipants &
		EffectParticipants<TEffects> &
		Readonly<Record<Exclude<keyof TParticipants, keyof TEffects>, never>>;
}

/** One configuration failure emitted by the public evaluator. */
export type PipelineConfigurationIssue =
	| {
			readonly kind: 'extension';
			readonly failure: GraphExtensionFailure;
	  }
	| { readonly kind: 'graph'; readonly diagnostic: GraphDiagnostic }
	| {
			readonly kind: 'role';
			readonly role: 'middleware' | 'observer' | 'participant';
			readonly index?: number;
			readonly key?: string;
			readonly error: GraphSchedulerError;
	  };

/** Algebraic failure before any graph work is admitted. */
export interface PipelineConfigurationFailure {
	readonly kind: 'configuration-failed';
	readonly primaryFailure: PipelineConfigurationIssue;
	readonly failures: readonly PipelineConfigurationIssue[];
	readonly extensionFailures: readonly GraphExtensionFailure[];
	readonly graphDiagnostics: readonly GraphDiagnostic[];
	readonly roleFailures: readonly Extract<
		PipelineConfigurationIssue,
		{ readonly kind: 'role' }
	>[];
}

/** Algebraic rejection of one caller-owned run-admission field. */
export interface PipelineAdmissionFailure {
	readonly kind: 'admission-failed';
	readonly field:
		| 'options'
		| 'pipeline'
		| 'inputs'
		| 'capabilities'
		| 'signal';
	readonly error: GraphSchedulerError;
}

/** Complete input for one fresh run over a configured Pipeline token. */
export interface RunPipelineOptions<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
> {
	readonly pipeline: Pipeline<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
	readonly inputs: NoInfer<TInputs>;
	readonly capabilities: NoInfer<TCapabilities>;
	readonly signal?: AbortSignal;
}

/** Exact algebraic result of configuration, compilation and evaluation. */
export type RunPipelineResult<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
> = MaybePromise<
	| PipelineAdmissionFailure
	| PipelineConfigurationFailure
	| RunOutcome<TNodes, GraphOutputs<TNodes, TProjection>, TEffects>
>;

/** Final node registry inferred from a creation-time extension tuple. */
export type PipelineNodes<
	TNodes extends NodeRegistry,
	TExtensions extends readonly GraphExtensionRegistrationShape[],
> = ExtensionNodes<TNodes, TExtensions>;

/** Final edge tuple inferred from a creation-time extension tuple. */
export type PipelineEdges<
	TEdges extends readonly Edge[],
	TExtensions extends readonly GraphExtensionRegistrationShape[],
> = ExtensionEdges<TEdges, TExtensions>;

type ClosedOutputProjection<TProjection> = Readonly<{
	[K in keyof TProjection as K extends string
		? string extends K
			? never
			: K
		: never]: TProjection[K];
}>;

/** Final output projection inferred from a creation-time extension tuple. */
export type PipelineProjection<
	TNodes extends NodeRegistry,
	TProjection,
	TExtensions extends readonly GraphExtensionRegistrationShape[],
> =
	ExtensionProjection<TProjection, TExtensions> extends infer TAccumulated
		? ClosedOutputProjection<TAccumulated> extends OutputProjection<
				ExtensionNodes<TNodes, TExtensions>
			>
			? ClosedOutputProjection<TAccumulated>
			: never
		: never;
