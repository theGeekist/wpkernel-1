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
import type { CheckedNodeMiddlewareRegistrations } from '../middleware/types.js';
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

/**
 * Immutable nominal authority for one configured process-local evaluator.
 *
 * Pipeline is deliberately data, not a method facade. Only {@link runPipeline}
 * can start a fresh run, and the token is meaningful only in the process that
 * created it. It is not a durable plan or a portable checkpoint.
 *
 * @public
 */
export interface Pipeline<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection,
	TCapabilities,
> {
	/** @hidden */
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

/**
 * Complete configuration captured by {@link createPipeline}.
 *
 * Registration is a one-shot immutable tuple. Extension configuration is
 * copied and frozen before contribution begins; capabilities remain run-local.
 *
 * @example One node, one named output
 * ```ts
 * import {
 *   createPipeline,
 *   runPipeline,
 *   type GraphDeclaration,
 *   type NodeContract,
 * } from '@wpkernel/pipeline';
 *
 * type Inputs = Readonly<{ source: string }>;
 * type Nodes = Readonly<{
 *   uppercase: NodeContract<'source', string, never>;
 * }>;
 * type Outputs = Readonly<{ result: 'uppercase' }>;
 *
 * const declaration: GraphDeclaration<
 *   Inputs,
 *   Nodes,
 *   readonly [],
 *   Readonly<Record<never, never>>,
 *   Outputs,
 *   Readonly<{ locale: string }>
 * > = {
 *   inputKeys: ['source'],
 *   nodes: {
 *     uppercase: { externalInputs: ['source'], effectKeys: [], priority: 0 },
 *   },
 *   edges: [],
 *   effects: {},
 *   outputs: { result: 'uppercase' },
 *   policy: { maxConcurrency: 1 },
 *   executors: {
 *     uppercase: ({ input }) => ({
 *       kind: 'success',
 *       output: input.external.source.toUpperCase(),
 *       effects: [],
 *     }),
 *   },
 * };
 *
 * const pipeline = createPipeline({ declaration, participants: {} });
 * const outcome = runPipeline({
 *   pipeline,
 *   inputs: { source: 'honest dataflow' },
 *   capabilities: { locale: 'en-SG' },
 * });
 * ```
 *
 * @public
 */
export interface CreatePipelineOptions<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	TExtensions extends readonly GraphExtensionRegistrationShape[],
	TParticipants extends Readonly<Record<PropertyKey, unknown>>,
	TMiddleware extends readonly object[],
> {
	readonly declaration: GraphDeclaration<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
	/**
	 * Ordered extension tuple. The type checker validates each contribution
	 * against the declaration plus every preceding contribution.
	 */
	readonly extensions?: TExtensions &
		CheckedGraphExtensionRegistrations<
			TInputs,
			TNodes,
			TEdges,
			TEffects,
			TCapabilities,
			NoInfer<TExtensions>
		>;
	/**
	 * Ordered middleware tuple. Each registration is checked against its exact
	 * node invocation, output, state and admitted effect requests.
	 */
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

/**
 * One retained extension, graph or role issue found before node admission.
 *
 * @public
 */
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

/**
 * Complete algebraic configuration failure before any graph work is admitted.
 *
 * Extension failures precede graph diagnostics, which precede role failures.
 * The corresponding arrays retain every knowable issue in canonical order.
 *
 * @public
 */
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

/**
 * Algebraic rejection of one caller-owned run-admission field.
 *
 * @public
 */
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

/**
 * Complete input for one fresh run over a configured {@link Pipeline} token.
 *
 * Inputs are validated, copied and frozen. Capabilities are opaque process-local
 * services whose provider owns concurrency safety.
 *
 * @public
 */
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

/**
 * Exact algebraic result of configuration, compilation and evaluation.
 *
 * The result stays synchronous until a participant return exposes a callable
 * `then`; that return is then adopted through normal promise resolution.
 *
 * @public
 */
export type RunPipelineResult<
	TNodes extends NodeRegistry,
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
> = MaybePromise<
	| PipelineAdmissionFailure
	| PipelineConfigurationFailure
	| RunOutcome<TNodes, GraphOutputs<TNodes, TProjection>, TEffects>
>;

/**
 * Final node registry inferred from a creation-time extension tuple.
 *
 * The emitted declaration retains every literal-keyed contribution. The API
 * projection shows its public {@link NodeRegistry} upper bound.
 *
 * @public
 */
export type PipelineNodes<
	TNodes extends NodeRegistry,
	TExtensions extends readonly GraphExtensionRegistrationShape[],
> = ExtensionNodes<TNodes, TExtensions>;

/**
 * Final edge tuple inferred from a creation-time extension tuple.
 *
 * The emitted declaration retains tuple order and literal endpoints. The API
 * projection shows its public readonly {@link Edge} upper bound.
 *
 * @public
 */
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

/**
 * Final output projection inferred from a creation-time extension tuple.
 *
 * The emitted declaration retains exact named projection keys. The API
 * projection shows the corresponding public {@link OutputProjection} bound.
 *
 * @public
 */
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
