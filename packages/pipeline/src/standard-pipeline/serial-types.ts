import type {
	EffectContract,
	MaybePromise,
	NodeContract,
} from '../v2/graph/types.js';
import type { NodeOutcome, RunFailure } from '../v2/scheduler/types.js';
import type {
	EffectJournalEntry,
	EffectJournalFailure,
} from '../v2/effects/types.js';
import type { RunObserverFailure } from '../v2/observers/types.js';
import type { RunDiagnostics } from '../v2/diagnostics/types.js';
import type {
	Helper,
	HelperApplyOptions,
	HelperKind,
	PipelineDiagnostic,
	PipelineExtensionRollbackErrorMetadata,
	PipelineReporter,
	PipelineRunState,
	PipelineStep,
} from '../core/types.js';
import type {
	FragmentFinalizationMetadata,
	PipelineExecutionMetadata,
} from './metadata.js';

declare const serialPipelineType: unique symbol;

interface InvariantTypeCell<in out T> {
	readonly value: T | undefined;
}

interface SerialPipelineWitness<TRunOptions, out TRunResult> {
	readonly options: InvariantTypeCell<TRunOptions>;
	readonly result: TRunResult | undefined;
}

/**
 * Frozen compatibility programme interpreted by one native v2 node.
 *
 * The token exposes no registration or execution methods. Its nominal witness
 * carries only the run-options and result types; programme authority remains
 * module-private.
 *
 * @typeParam TRunOptions - Input accepted by one run.
 * @typeParam TRunResult - Successful compatibility result.
 * @public
 */
export interface SerialPipeline<TRunOptions, TRunResult> {
	readonly kind: 'serial-pipeline';
	readonly [serialPipelineType]: SerialPipelineWitness<
		TRunOptions,
		TRunResult
	>;
}

/** Lifecycle boundaries admitted by a serial compatibility programme. @public */
export type SerialPipelineLifecycle =
	| 'after-fragments'
	| 'before-builders'
	| 'after-builders'
	| 'finalize';

/** Arguments supplied to one serial lifecycle hook. @public */
export interface SerialPipelineHookOptions<TContext, TRunOptions, TArtifact> {
	readonly context: TContext;
	readonly options: TRunOptions;
	readonly artifact: TArtifact;
	readonly lifecycle: SerialPipelineLifecycle;
}

/**
 * Optional artifact replacement and settlement callbacks returned by a hook.
 * Callbacks are captured into the run's single compatibility effect journal.
 * @public
 */
export interface SerialPipelineHookResult<TArtifact> {
	readonly artifact?: TArtifact;
	readonly commit?: () => MaybePromise<void>;
	readonly rollback?: () => MaybePromise<void>;
}

/** One exact synchronous-or-asynchronous serial lifecycle hook. @public */
export type SerialPipelineHook<TContext, TRunOptions, TArtifact> = (
	options: SerialPipelineHookOptions<TContext, TRunOptions, TArtifact>
) => MaybePromise<SerialPipelineHookResult<TArtifact> | void>;

/** One statically declared v1 lifecycle hook. @public */
export interface SerialPipelineExtension<TContext, TRunOptions, TArtifact> {
	/** Stable extension identity used by diagnostics and settlement. */
	readonly key: string;
	/** Evaluation boundary, defaulting to `after-fragments`. */
	readonly lifecycle?: SerialPipelineLifecycle;
	/** Hook evaluated at the declared boundary. */
	readonly hook: SerialPipelineHook<TContext, TRunOptions, TArtifact>;
}

/** Internal structural fields for serial programme authoring. @internal */
interface SerialPipelineBaseOptions<
	TRunOptions,
	TBuildOptions,
	TContext extends { reporter: PipelineReporter },
	TDraft = unknown,
	TArtifact = unknown,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
> {
	/** Runtime kind for fragment helpers. @defaultValue `'fragment'` */
	readonly fragmentKind?: HelperKind;
	/** Runtime kind for builder helpers. @defaultValue `'builder'` */
	readonly builderKind?: HelperKind;
	/** Creates domain errors for invalid static programmes. */
	readonly createError?: (code: string, message: string) => Error;
	/** Derives build configuration for one run. */
	readonly createBuildOptions: (options: TRunOptions) => TBuildOptions;
	/** Creates the run context and its reporter. */
	readonly createContext: (options: TRunOptions) => TContext;
	/** Creates the initial fragment draft. */
	readonly createFragmentState: (options: {
		readonly options: TRunOptions;
		readonly context: TContext;
		readonly buildOptions: TBuildOptions;
	}) => TDraft;
	/** Projects the current fragment state into helper arguments. */
	readonly createFragmentArgs: (options: {
		readonly helper: Helper<
			TContext,
			TFragmentInput,
			TFragmentOutput,
			TContext['reporter'],
			HelperKind
		>;
		readonly options: TRunOptions;
		readonly context: TContext;
		readonly buildOptions: TBuildOptions;
		readonly draft: TDraft;
	}) => HelperApplyOptions<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TContext['reporter']
	>;
	/** Adopts an immutable fragment replacement into the draft. */
	readonly adoptFragmentOutput?: (options: {
		readonly draft: TDraft;
		readonly output: TFragmentOutput;
	}) => TDraft;
	/** Finalises the fragment draft into the builder artifact. */
	readonly finalizeFragmentState: (options: {
		readonly draft: TDraft;
		readonly options: TRunOptions;
		readonly context: TContext;
		readonly buildOptions: TBuildOptions;
		readonly helpers: FragmentFinalizationMetadata<HelperKind>;
	}) => TArtifact;
	/** Projects the current artifact into builder helper arguments. */
	readonly createBuilderArgs: (options: {
		readonly helper: Helper<
			TContext,
			TBuilderInput,
			TBuilderOutput,
			TContext['reporter'],
			HelperKind
		>;
		readonly options: TRunOptions;
		readonly context: TContext;
		readonly buildOptions: TBuildOptions;
		readonly artifact: TArtifact;
	}) => HelperApplyOptions<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TContext['reporter']
	>;
	/** Adopts an immutable builder replacement into the artifact. */
	readonly adoptBuilderOutput?: (options: {
		readonly artifact: TArtifact;
		readonly output: TBuilderOutput;
	}) => TArtifact;
	/**
	 * Observes a contained diagnostic for each run invocation. Delivery is
	 * invocation-owned and is not suppressed when runs share reporter identity
	 * or a diagnostic factory reuses an object.
	 */
	readonly onDiagnostic?: (options: {
		readonly reporter: TContext['reporter'];
		readonly diagnostic: PipelineDiagnostic;
	}) => void;
	/**
	 * Observes a contained extension compensation failure. Observer failure is
	 * contained independently, so it cannot suppress the reporter warning or
	 * later compensation work.
	 */
	readonly onExtensionRollbackError?: (options: {
		readonly error: unknown;
		readonly extensionKeys: readonly string[];
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;
	/**
	 * Observes a contained helper compensation failure. Observer failure is
	 * contained independently, so it cannot suppress the reporter warning or
	 * later compensation work.
	 */
	readonly onHelperRollbackError?: (options: {
		readonly error: unknown;
		readonly helper:
			| Helper<
					TContext,
					TFragmentInput,
					TFragmentOutput,
					TContext['reporter'],
					HelperKind
			  >
			| Helper<
					TContext,
					TBuilderInput,
					TBuilderOutput,
					TContext['reporter'],
					HelperKind
			  >;
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;
	/** Fragment dependency keys admitted outside this programme. */
	readonly fragmentProvidedKeys?: readonly string[];
	/** Builder dependency keys admitted outside this programme. */
	readonly builderProvidedKeys?: readonly string[];
	/** Creates a diagnostic for an absent dependency. */
	readonly createMissingDependencyDiagnostic?: (options: {
		readonly helper:
			| Helper<
					TContext,
					TFragmentInput,
					TFragmentOutput,
					TContext['reporter'],
					HelperKind
			  >
			| Helper<
					TContext,
					TBuilderInput,
					TBuilderOutput,
					TContext['reporter'],
					HelperKind
			  >;
		readonly dependency: string;
		readonly message: string;
	}) => PipelineDiagnostic;
	/** Creates a diagnostic for a helper excluded from serial order. */
	readonly createUnusedHelperDiagnostic?: (options: {
		readonly helper:
			| Helper<
					TContext,
					TFragmentInput,
					TFragmentOutput,
					TContext['reporter'],
					HelperKind
			  >
			| Helper<
					TContext,
					TBuilderInput,
					TBuilderOutput,
					TContext['reporter'],
					HelperKind
			  >;
		readonly message: string;
	}) => PipelineDiagnostic;
	/** Fragment helpers captured into the immutable serial programme. */
	readonly fragments: readonly Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TContext['reporter'],
		HelperKind
	>[];
	/** Builder helpers captured into the immutable serial programme. */
	readonly builders: readonly Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TContext['reporter'],
		HelperKind
	>[];
	/** Lifecycle hooks captured into the immutable serial programme. */
	readonly extensions?: readonly SerialPipelineExtension<
		TContext,
		TRunOptions,
		TArtifact
	>[];
}

type SerialRunResultFactory<
	TRunOptions,
	TBuildOptions,
	TContext,
	TArtifact,
	TRunResult,
> = (options: {
	readonly artifact: TArtifact;
	readonly diagnostics: readonly PipelineDiagnostic[];
	readonly steps: readonly PipelineStep[];
	readonly context: TContext;
	readonly buildOptions: TBuildOptions;
	readonly options: TRunOptions;
	readonly helpers: PipelineExecutionMetadata<HelperKind, HelperKind>;
}) => TRunResult;

type SerialRunResultAdapter<TDefault, TResult, TFactory> = [TResult] extends [
	TDefault,
]
	? [TDefault] extends [TResult]
		? { readonly createRunResult?: TFactory }
		: { readonly createRunResult: TFactory }
	: { readonly createRunResult: TFactory };

/**
 * Static serial programme captured by `createSerialPipeline`.
 *
 * `fragments`, `builders` and `extensions` are copied at construction. A
 * custom `TRunResult` requires `createRunResult`; it is optional only when the
 * result is the default `PipelineRunState` projection.
 *
 * @typeParam TRunOptions - Public input for a run.
 * @typeParam TBuildOptions - Normalised options shared by programme stages.
 * @typeParam TContext - Per-run context containing its reporter.
 * @typeParam TDraft - Fragment accumulator.
 * @typeParam TArtifact - Value handed from fragments to builders.
 * @typeParam TRunResult - Final successful result.
 * @typeParam TFragmentInput - Fragment input projection.
 * @typeParam TFragmentOutput - Fragment output projection.
 * @typeParam TBuilderInput - Builder input projection.
 * @typeParam TBuilderOutput - Builder output projection.
 * @public
 */
export type CreateSerialPipelineOptions<
	TRunOptions,
	TBuildOptions,
	TContext extends { reporter: PipelineReporter },
	TDraft = unknown,
	TArtifact = unknown,
	TRunResult = PipelineRunState<TArtifact, PipelineDiagnostic>,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
> = SerialPipelineBaseOptions<
	TRunOptions,
	TBuildOptions,
	TContext,
	TDraft,
	TArtifact,
	TFragmentInput,
	TFragmentOutput,
	TBuilderInput,
	TBuilderOutput
> &
	SerialRunResultAdapter<
		PipelineRunState<TArtifact, PipelineDiagnostic>,
		TRunResult,
		SerialRunResultFactory<
			TRunOptions,
			TBuildOptions,
			TContext,
			TArtifact,
			TRunResult
		>
	>;

/** Options for one serial compatibility run. @public */
export interface RunSerialPipelineOptions<TRunOptions, TRunResult> {
	/** Frozen programme token returned by `createSerialPipeline`. */
	readonly pipeline: SerialPipeline<TRunOptions, TRunResult>;
	/** Host input for this run. */
	readonly options: TRunOptions;
	/** Optional cancellation signal observed by the native scheduler. */
	readonly signal?: AbortSignal;
}

type SerialNativeNodes = Readonly<{
	readonly 'serial.compatibility': NodeContract<
		never,
		string,
		unknown,
		'serial.evaluate'
	>;
}>;

type SerialNativeEffects = Readonly<{
	readonly 'serial.evaluate': EffectContract<string, unknown, null, unknown>;
}>;

/** Authority-free fields shared by native serial outcomes. @internal */
type SerialNativeProjection = {
	readonly nodes: readonly NodeOutcome<
		SerialNativeNodes,
		SerialNativeEffects
	>[];
	readonly observerFailures: readonly RunObserverFailure[];
	readonly effectJournal: readonly EffectJournalEntry<SerialNativeEffects>[];
	readonly effectFailures: readonly EffectJournalFailure<SerialNativeEffects>[];
	readonly diagnostics: RunDiagnostics;
};

/**
 * Authority-free native evidence retained by the compatibility projection.
 *
 * Prepared values and participant receipts are typed as unknown and are never
 * projected into the public journal. Suspension is impossible at this boundary.
 * @public
 */
export type SerialNativeOutcome = SerialNativeProjection &
	(
		| {
				readonly kind: 'succeeded';
				readonly outputs: Readonly<{ readonly result: string }>;
		  }
		| {
				readonly kind: 'failed';
				readonly primaryFailure: RunFailure<
					SerialNativeNodes,
					SerialNativeEffects
				>;
				readonly failures: readonly RunFailure<
					SerialNativeNodes,
					SerialNativeEffects
				>[];
		  }
		| { readonly kind: 'cancelled'; readonly reason?: unknown }
	);

/**
 * Algebraic projection of the native one-node compatibility run.
 * `native` records node, diagnostic and aggregate effect settlement evidence.
 * Admission failures can occur before that evidence exists.
 * @public
 */
export type SerialRunOutcome<TRunResult> =
	| {
			readonly kind: 'succeeded';
			readonly result: TRunResult;
			readonly native: SerialNativeOutcome;
	  }
	| {
			readonly kind: 'failed';
			readonly error: unknown;
			readonly native?: SerialNativeOutcome;
	  }
	| {
			readonly kind: 'cancelled';
			readonly reason?: unknown;
			readonly native: SerialNativeOutcome;
	  };

/** Exact synchronous-or-asynchronous compatibility settlement. @public */
export type SerialRunResult<TRunResult> = MaybePromise<
	SerialRunOutcome<TRunResult>
>;
