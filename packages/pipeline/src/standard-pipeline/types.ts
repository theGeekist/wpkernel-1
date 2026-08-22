import type {
	Helper,
	HelperApplyOptions,
	HelperKind,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
	PipelineStep,
	PipelineExtensionRollbackErrorMetadata,
} from '../core/types.js';
import type { StandardPipelineExtension } from './extension.js';
import type {
	FragmentFinalizationMetadata,
	PipelineExecutionMetadata,
} from './metadata.js';
import type { Pipeline } from './pipeline.js';
export type {
	PipelineExtensionRollbackErrorMetadata,
	PipelineReporter,
	PipelineRunState,
};
export type {
	FragmentFinalizationMetadata,
	Pipeline,
	PipelineExecutionMetadata,
	StandardPipelineExtension,
};

/**
 * Options for creating a pipeline.
 * @public
 */
interface CreatePipelineBaseOptions<
	TRunOptions,
	TBuildOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TDraft = unknown,
	TArtifact = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
	TFragmentKind extends HelperKind = 'fragment',
	TBuilderKind extends HelperKind = 'builder',
	TFragmentHelper extends Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter,
		TFragmentKind
	> = Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter,
		TFragmentKind
	>,
	TBuilderHelper extends Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter,
		TBuilderKind
	> = Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter,
		TBuilderKind
	>,
> {
	/**
	 * Runtime kind accepted by {@link Pipeline.ir}.
	 * @defaultValue `'fragment'`
	 */
	readonly fragmentKind?: TFragmentKind;
	/**
	 * Runtime kind accepted by {@link Pipeline.builders}.
	 * @defaultValue `'builder'`
	 */
	readonly builderKind?: TBuilderKind;
	/** Creates package-specific errors for configuration validation failures. */
	readonly createError?: (code: string, message: string) => Error;
	/**
	 * Derives run-scoped build configuration from the caller's run options.
	 * The returned value is shared by fragment finalisation, builders and the
	 * custom result adapter for that run.
	 */
	readonly createBuildOptions: (options: TRunOptions) => TBuildOptions;
	/**
	 * Creates the run context. Its reporter receives warnings and accompanies
	 * helper, extension, rollback and result callbacks for the whole run.
	 */
	readonly createContext: (options: TRunOptions) => TContext;
	/** Creates the mutable or immutable draft consumed by fragment helpers. */
	readonly createFragmentState: (options: {
		/** Options passed to {@link Pipeline.run}. */
		readonly options: TRunOptions;
		/** Context created for this run. */
		readonly context: TContext;
		/** Build options derived for this run. */
		readonly buildOptions: TBuildOptions;
	}) => TDraft;
	/**
	 * Maps a registered fragment helper and current draft into its apply
	 * arguments. The returned output may be a mutable view of the draft or an
	 * immutable value adopted through {@link CreatePipelineOptions.adoptFragmentOutput}.
	 */
	readonly createFragmentArgs: (options: {
		/** Fragment helper about to execute. */
		readonly helper: TFragmentHelper;
		/** Options passed to {@link Pipeline.run}. */
		readonly options: TRunOptions;
		/** Context created for this run. */
		readonly context: TContext;
		/** Build options derived for this run. */
		readonly buildOptions: TBuildOptions;
		/** Current draft, including any adopted earlier fragment output. */
		readonly draft: TDraft;
	}) => HelperApplyOptions<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter
	>;
	/**
	 * Adopts a replacement fragment output into the draft used for finalization.
	 *
	 * Omit this when fragment outputs are mutable views over the draft and do not
	 * require replacement.
	 */
	readonly adoptFragmentOutput?: (options: {
		/** Draft current before the helper's replacement output is adopted. */
		readonly draft: TDraft;
		/** Final output returned by the fragment helper chain. */
		readonly output: TFragmentOutput;
	}) => TDraft;
	/**
	 * Finalises the fragment draft into the public artifact. Extension hooks do
	 * not run until this conversion has completed.
	 */
	readonly finalizeFragmentState: (options: {
		/** Draft after all fragment output adoption. */
		readonly draft: TDraft;
		/** Options passed to {@link Pipeline.run}. */
		readonly options: TRunOptions;
		/** Context created for this run. */
		readonly context: TContext;
		/** Build options derived for this run. */
		readonly buildOptions: TBuildOptions;
		/** Fragment resolution and execution metadata. */
		readonly helpers: FragmentFinalizationMetadata<TFragmentKind>;
	}) => TArtifact;
	/**
	 * Maps a registered builder helper and current artifact into its apply
	 * arguments. Builders see replacements produced by earlier extension hooks
	 * and builders.
	 */
	readonly createBuilderArgs: (options: {
		/** Builder helper about to execute. */
		readonly helper: TBuilderHelper;
		/** Options passed to {@link Pipeline.run}. */
		readonly options: TRunOptions;
		/** Context created for this run. */
		readonly context: TContext;
		/** Build options derived for this run. */
		readonly buildOptions: TBuildOptions;
		/** Current finalised artifact. */
		readonly artifact: TArtifact;
	}) => HelperApplyOptions<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter
	>;
	/**
	 * Adopts a replacement builder output into the artifact returned by the run.
	 *
	 * Omit this when builder outputs are mutable views over the artifact or are
	 * intentionally stage-local.
	 */
	readonly adoptBuilderOutput?: (options: {
		/** Artifact current before the helper's replacement output is adopted. */
		readonly artifact: TArtifact;
		/** Final output returned by the builder helper chain. */
		readonly output: TBuilderOutput;
	}) => TArtifact;
	/**
	 * Optional hook invoked whenever a diagnostic is emitted during a run.
	 *
	 * Consumers can stream diagnostics to logs or UI shells while the pipeline
	 * executes instead of waiting for the final run result. Observer failures
	 * are contained and cannot alter pipeline settlement. Each diagnostic is
	 * delivered at most once to a given reporter instance.
	 */
	readonly onDiagnostic?: (options: {
		/** Reporter owned by the current run context. */
		readonly reporter: TReporter;
		/** Diagnostic just admitted to the run. */
		readonly diagnostic: TDiagnostic;
	}) => void;
	/**
	 * Observes an extension rollback failure after the runner has contained it.
	 * Remaining rollback work continues and the original pipeline failure keeps
	 * control of settlement.
	 */
	readonly onExtensionRollbackError?: (options: {
		/** Error thrown by extension rollback work. */
		readonly error: unknown;
		/** Keys of the hooks participating in that lifecycle execution. */
		readonly extensionKeys: readonly string[];
		/** Descriptor-safe metadata derived from the rollback error. */
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		/** Context of the failing run. */
		readonly context: TContext;
	}) => void;
	/**
	 * Observes a helper rollback failure after the runner has contained it.
	 * The original helper object is preserved for attribution.
	 */
	readonly onHelperRollbackError?: (options: {
		/** Error thrown by helper rollback work. */
		readonly error: unknown;
		/** Fragment or builder helper that registered the rollback. */
		readonly helper: TFragmentHelper | TBuilderHelper;
		/** Descriptor-safe metadata derived from the rollback error. */
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		/** Context of the failing run. */
		readonly context: TContext;
	}) => void;
	/**
	 * Helper keys that should be treated as "already satisfied" for fragment
	 * dependency resolution (useful when a run intentionally omits certain
	 * fragments).
	 */
	readonly fragmentProvidedKeys?: readonly string[];
	/**
	 * Helper keys that should be treated as “already satisfied” for builder
	 * dependency resolution (e.g. builders depending on IR helpers that are
	 * executed in a different pipeline stage).
	 */
	readonly builderProvidedKeys?: readonly string[];
	/** Creates a domain-specific diagnostic for a registration conflict. */
	readonly createConflictDiagnostic?: (options: {
		/** Helper whose registration caused the conflict. */
		readonly helper: TFragmentHelper | TBuilderHelper;
		/** Previously registered conflicting helper. */
		readonly existing: TFragmentHelper | TBuilderHelper;
		/** Human-readable conflict description. */
		readonly message: string;
	}) => TDiagnostic;
	/** Creates a domain-specific diagnostic for an unknown dependency key. */
	readonly createMissingDependencyDiagnostic?: (options: {
		/** Helper declaring the missing dependency. */
		readonly helper: TFragmentHelper | TBuilderHelper;
		/** Dependency key that could not be resolved. */
		readonly dependency: string;
		/** Human-readable dependency description. */
		readonly message: string;
	}) => TDiagnostic;
	/** Creates a domain-specific diagnostic for a helper that cannot execute. */
	readonly createUnusedHelperDiagnostic?: (options: {
		/** Helper excluded from the executable dependency order. */
		readonly helper: TFragmentHelper | TBuilderHelper;
		/** Human-readable exclusion description. */
		readonly message: string;
	}) => TDiagnostic;
}

/**
 * Adapts completed standard pipeline state into a consumer-defined result.
 * @public
 */
type StandardRunResultFactory<
	TRunOptions,
	TBuildOptions,
	TContext,
	TArtifact,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
	TFragmentKind extends HelperKind,
	TBuilderKind extends HelperKind,
> = (options: {
	/** Final artifact after builder and extension replacements. */
	readonly artifact: TArtifact;
	/** Invocation-owned diagnostics accumulated by the run. */
	readonly diagnostics: readonly TDiagnostic[];
	/** Ordered trace of helpers executed by the run. */
	readonly steps: readonly PipelineStep[];
	/** Context created for the run. */
	readonly context: TContext;
	/** Build options derived for the run. */
	readonly buildOptions: TBuildOptions;
	/** Options originally passed to {@link Pipeline.run}. */
	readonly options: TRunOptions;
	/** Fragment and builder resolution and execution snapshots. */
	readonly helpers: PipelineExecutionMetadata<TFragmentKind, TBuilderKind>;
}) => TRunResult;

type RunResultAdapter<TDefault, TResult, TFactory> = [TResult] extends [
	TDefault,
]
	? [TDefault] extends [TResult]
		? {
				/**
				 * Adapts completed run state. Optional when `TRunResult` is the
				 * standard {@link PipelineRunState} shape.
				 */
				readonly createRunResult?: TFactory;
			}
		: {
				/** Adapts completed run state into the requested custom result. */
				readonly createRunResult: TFactory;
			}
	: {
			/** Adapts completed run state into the requested custom result. */
			readonly createRunResult: TFactory;
		};

/**
 * Options for creating a standard pipeline.
 *
 * A run creates build options, context and draft, executes fragment helpers,
 * finalises the draft, runs `after-fragments` and `before-builders` extension
 * hooks, executes builder helpers, then runs `after-builders` and `finalize`
 * hooks before materialising the result.
 *
 * Fragment and builder helpers may mutate shared output objects. When helpers
 * instead return immutable replacement values, provide `adoptFragmentOutput`
 * or `adoptBuilderOutput` to make those replacements the input to the next
 * phase. A custom `TRunResult` requires `createRunResult`; omitting the adapter
 * fixes the result to {@link PipelineRunState}.
 *
 * @example Immutable draft and artifact adoption
 * ```ts
 * const pipeline = createPipeline({
 *   createBuildOptions: () => ({}),
 *   createContext: () => ({ reporter: console }),
 *   createFragmentState: () => [] as string[],
 *   createFragmentArgs: ({ context, draft }) => ({
 *     context,
 *     input: undefined,
 *     output: draft,
 *     reporter: context.reporter,
 *   }),
 *   adoptFragmentOutput: ({ output }) => output,
 *   finalizeFragmentState: ({ draft }) => ({ entries: draft }),
 *   createBuilderArgs: ({ context, artifact }) => ({
 *     context,
 *     input: undefined,
 *     output: artifact,
 *     reporter: context.reporter,
 *   }),
 * });
 * ```
 *
 * @see {@link Pipeline}
 * @see {@link StandardPipelineExtension}
 * @public
 */
export type CreatePipelineOptions<
	TRunOptions,
	TBuildOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TDraft = unknown,
	TArtifact = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TArtifact, TDiagnostic>,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
	TFragmentKind extends HelperKind = 'fragment',
	TBuilderKind extends HelperKind = 'builder',
	TFragmentHelper extends Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter,
		TFragmentKind
	> = Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter,
		TFragmentKind
	>,
	TBuilderHelper extends Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter,
		TBuilderKind
	> = Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter,
		TBuilderKind
	>,
> = CreatePipelineBaseOptions<
	TRunOptions,
	TBuildOptions,
	TContext,
	TReporter,
	TDraft,
	TArtifact,
	TDiagnostic,
	TFragmentInput,
	TFragmentOutput,
	TBuilderInput,
	TBuilderOutput,
	TFragmentKind,
	TBuilderKind,
	TFragmentHelper,
	TBuilderHelper
> &
	RunResultAdapter<
		PipelineRunState<TArtifact, TDiagnostic>,
		TRunResult,
		StandardRunResultFactory<
			TRunOptions,
			TBuildOptions,
			TContext,
			TArtifact,
			TDiagnostic,
			TRunResult,
			TFragmentKind,
			TBuilderKind
		>
	>;
