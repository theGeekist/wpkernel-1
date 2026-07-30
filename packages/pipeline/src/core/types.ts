import type { PipelineRollback } from './rollback.js';

/**
 * A type that can be either a value or a Promise of a value.
 * @public
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Helper kind identifier.
 * @public
 */
export type HelperKind = string;

/**
 * Helper execution mode - determines how it integrates with existing helpers.
 *
 * @remarks
 * Currently only `extend` and `override` modes have implementation/validation logic.
 * The `merge` mode is reserved for future use.
 *
 * @public
 */
export type HelperMode = 'extend' | 'override' | 'merge';

/**
 * Base error type for pipeline operations.
 * Consumers can extend this to add framework-specific error codes.
 * @public
 */
export interface PipelineError extends Error {
	readonly code: string;
	readonly data?: Record<string, unknown>;
	readonly context?: Record<string, unknown>;
}

/**
 * Interface for reporting pipeline events and warnings.
 * @public
 */
export interface PipelineReporter {
	warn?: (message: string, context?: unknown) => void;
}

/**
 * Base descriptor for a pipeline helper.
 * @public
 */
export interface HelperDescriptor<TKind extends HelperKind = HelperKind> {
	readonly key: string;
	readonly kind: TKind;
	readonly mode: HelperMode;
	readonly priority: number;
	readonly dependsOn: readonly string[];
	readonly origin?: string;
	/**
	 * Whether this helper is optional and may not execute.
	 * Optional helpers won't cause validation errors if they don't run.
	 * Useful for conditional/feature-flag helpers.
	 * @defaultValue false
	 */
	readonly optional?: boolean;
}

/**
 * Options passed to a helper's apply function.
 * @public
 */
export interface HelperApplyOptions<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
> {
	readonly context: TContext;
	readonly input: TInput;
	readonly output: TOutput;
	readonly reporter: TReporter;
}
/**
 * Result returned from a helper's apply function.
 *
 * Helpers can declare rollback operations to be executed if the pipeline
 * encounters a failure after the helper completes.
 *
 * @public
 */
export interface HelperApplyResult<TOutput> {
	readonly output?: TOutput;
	readonly rollback?: PipelineRollback;
}

/**
 * Explicit continuation for wrapping the remainder of a helper chain.
 *
 * Calling the continuation executes downstream helpers with either the supplied
 * output or the current helper output. The returned value is the final output
 * produced by those helpers.
 *
 * @public
 */
export interface HelperNext<TOutput> {
	(): MaybePromise<TOutput>;
	(output: TOutput): MaybePromise<TOutput>;
}

/**
 * Function signature for a pipeline helper's apply method.
 *
 * This function is responsible for transforming the pipeline's input and output.
 * It can optionally call `next()` to wrap the remainder of the helper chain.
 *
 * Helpers can also return a result object with transformed output and optional rollback
 * for cleanup if the pipeline fails after the helper executes.
 *
 * @template TContext - The type of the pipeline context.
 * @template TInput - The type of the input artifact.
 * @template TOutput - The type of the output artifact.
 * @template TReporter - The type of the reporter used for logging.
 * @param    options - Options for the apply function, including context, input, output, and reporter.
 * @param    next    - Optional continuation that returns the downstream output.
 * @returns A promise that resolves when the helper has finished its work, or a result object with optional output and rollback.
 * @public
 */
export type HelperApplyFn<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
> = (
	options: HelperApplyOptions<TContext, TInput, TOutput, TReporter>,
	next?: HelperNext<TOutput>
) => MaybePromise<HelperApplyResult<TOutput> | void>;

/**
 * A complete pipeline helper with descriptor and apply function.
 * @public
 */
export interface Helper<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
	TKind extends HelperKind = HelperKind,
> extends HelperDescriptor<TKind> {
	readonly apply: HelperApplyFn<TContext, TInput, TOutput, TReporter>;
}

/**
 * Options for creating a new helper.
 * @public
 */
export interface CreateHelperOptions<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
	TKind extends HelperKind = HelperKind,
> {
	readonly key: string;
	readonly kind: TKind;
	readonly mode?: HelperMode;
	readonly priority?: number;
	readonly dependsOn?: readonly string[];
	readonly origin?: string;
	readonly apply: HelperApplyFn<TContext, TInput, TOutput, TReporter>;
}

/**
 * A pipeline step representing an executed helper.
 * @public
 */
export interface PipelineStep<TKind extends HelperKind = HelperKind>
	extends HelperDescriptor<TKind> {
	readonly id: string;
	readonly index: number;
}

/**
 * Diagnostic for conflicting helper registrations.
 * @public
 */
export interface ConflictDiagnostic<TKind extends HelperKind = HelperKind> {
	readonly type: 'conflict';
	readonly key: string;
	readonly mode: HelperMode;
	readonly helpers: readonly string[];
	readonly message: string;
	readonly kind?: TKind;
}

/**
 * Diagnostic for missing helper dependencies.
 * @public
 */
export interface MissingDependencyDiagnostic<
	TKind extends HelperKind = HelperKind,
> {
	readonly type: 'missing-dependency';
	readonly key: string;
	readonly dependency: string;
	readonly message: string;
	readonly kind?: TKind;
	readonly helper?: string;
}

/**
 * Diagnostic for unused helpers.
 * @public
 */
export interface UnusedHelperDiagnostic<TKind extends HelperKind = HelperKind> {
	readonly type: 'unused-helper';
	readonly key: string;
	readonly message: string;
	readonly kind?: TKind;
	readonly helper?: string;
	readonly dependsOn?: readonly string[];
}

/**
 * Union of all diagnostic types.
 * @public
 */
export type PipelineDiagnostic<TKind extends HelperKind = HelperKind> =
	| ConflictDiagnostic<TKind>
	| MissingDependencyDiagnostic<TKind>
	| UnusedHelperDiagnostic<TKind>;

/**
 * State returned from a pipeline run.
 * @public
 */
export interface PipelineRunState<
	TArtifact,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
> {
	readonly artifact: TArtifact;
	readonly diagnostics: readonly TDiagnostic[];
	readonly steps: readonly PipelineStep[];
}

/**
 * Snapshot of helper execution status.
 * @public
 */
export interface HelperExecutionSnapshot<
	TKind extends HelperKind = HelperKind,
> {
	readonly kind: TKind;
	readonly registered: readonly string[];
	readonly executed: readonly string[];
	readonly missing: readonly string[];
}

/**
 * Pause kind identifier for resumable pipeline runs.
 * @public
 */
export type PipelinePauseKind = string;

/**
 * Options for pausing a pipeline run.
 * @public
 */
export interface PipelinePauseOptions {
	readonly token?: unknown;
	readonly pauseKind?: PipelinePauseKind;
	readonly payload?: unknown;
}

/**
 * Snapshot captured when a pipeline run pauses.
 *
 * This is a process-local suspension value. Its state can contain live maps,
 * sets, functions, extension coordinators, rollback callbacks, and other
 * non-serializable runtime objects. Consumers must not persist or transport it
 * as a durable checkpoint.
 *
 * @public
 */
export interface PipelinePauseSnapshot<TState> {
	readonly stageIndex: number;
	readonly state: TState;
	readonly token?: unknown;
	readonly pauseKind?: PipelinePauseKind;
	readonly createdAt: number;
	readonly payload?: unknown;
}

/**
 * Pause result returned from a pipeline run.
 * @public
 */
export interface PipelinePaused<TState> {
	readonly __paused: true;
	readonly snapshot: PipelinePauseSnapshot<TState>;
}

/**
 * Public state threaded through custom pipeline stages.
 *
 * Consumer stages may replace `userState` immutably by returning a spread of
 * the received state. Runner-owned fields are preserved by that spread without
 * becoming part of the public custom-stage contract.
 *
 * @public
 */
declare const pipelineStageStateBrand: unique symbol;

export interface PipelineStageState<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
> {
	/**
	 * Prevents consumers from constructing runner state from scratch. Derive
	 * replacement state from the value supplied to the stage instead.
	 *
	 * @internal
	 */
	readonly [pipelineStageStateBrand]: true;
	readonly context: TContext;
	readonly reporter: TReporter;
	readonly runOptions: TRunOptions;
	readonly userState: TUserState;
	readonly steps: readonly PipelineStep[];
	readonly diagnostics: readonly TDiagnostic[];
	readonly executedLifecycles: ReadonlySet<string>;
	readonly helperExecution?: ReadonlyMap<string, HelperExecutionSnapshot>;
	readonly stageIndex?: number;
	readonly resumeInput?: unknown;
}

/**
 * Terminal result produced by a custom pipeline stage.
 *
 * @public
 */
export interface PipelineHalt<TRunResult> {
	readonly __halt: true;
	readonly error?: unknown;
	readonly result?: TRunResult;
	/** @internal */
	readonly __hasError?: true;
	/** @internal */
	readonly __rollbackApplied?: true;
}

/**
 * Result accepted from a custom pipeline stage.
 *
 * @public
 */
export type PipelineStageResult<TState, TRunResult> =
	| TState
	| PipelinePaused<TState>
	| PipelineHalt<TRunResult>;

/**
 * A synchronous-or-asynchronous custom pipeline stage.
 *
 * @public
 */
export type PipelineStage<TState, TRunResult> = (
	state: TState
) => MaybePromise<PipelineStageResult<TState, TRunResult>>;

/**
 * Public registration metadata supplied to helper-stage argument factories.
 *
 * @public
 */
export interface PipelineRegisteredHelper<THelper> {
	readonly helper: THelper;
	readonly id: string;
	readonly index: number;
}

/**
 * A rollback captured while executing a helper stage.
 *
 * @public
 */
export interface PipelineHelperRollback<THelper> {
	readonly helper: THelper;
	readonly rollback: PipelineRollback;
}

/**
 * Options for constructing a typed helper stage.
 *
 * @public
 */
export interface PipelineHelperStageOptions<
	TState,
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter,
	TKind extends HelperKind,
	THelper extends Helper<TContext, TInput, TOutput, TReporter, TKind>,
> {
	readonly makeArgs?: (
		state: TState
	) => (
		entry: PipelineRegisteredHelper<THelper>
	) => HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
	readonly writeOutput?: (state: TState, output: TOutput) => TState;
	readonly onVisited?: (
		state: TState,
		visited: ReadonlySet<string>,
		registered: readonly PipelineRegisteredHelper<THelper>[],
		rollbacks: readonly PipelineHelperRollback<THelper>[],
		output: TOutput
	) => TState;
}

/**
 * Diagnostic capabilities available to custom stages.
 *
 * @public
 */
export interface PipelineStageDiagnostics<
	TDiagnostic extends PipelineDiagnostic,
	TKind extends HelperKind,
> {
	readonly record: (diagnostic: TDiagnostic) => void;
	readonly flagUnusedHelper: (
		helper: HelperDescriptor<TKind>,
		kind: TKind,
		message: string,
		dependsOn?: readonly string[]
	) => void;
}

/**
 * Stable, domain-neutral dependencies supplied to `createStages`.
 *
 * @public
 */
export interface PipelineStageDependencies<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TUserState, TDiagnostic>,
	TKind extends HelperKind = HelperKind,
> {
	readonly finalizeResult: PipelineStage<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>;
	readonly makeLifecycleStage: (
		lifecycle: string
	) => PipelineStage<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>;
	readonly commitStage: PipelineStage<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>;
	readonly makeHelperStage: <
		TInput = TRunOptions,
		TOutput = TUserState,
		TSelectedKind extends TKind = TKind,
		THelper extends Helper<
			TContext,
			TInput,
			TOutput,
			TReporter,
			TSelectedKind
		> = Helper<TContext, TInput, TOutput, TReporter, TSelectedKind>,
	>(
		kind: TSelectedKind,
		options?: PipelineHelperStageOptions<
			PipelineStageState<
				TRunOptions,
				TUserState,
				TContext,
				TReporter,
				TDiagnostic
			>,
			TContext,
			TInput,
			TOutput,
			TReporter,
			TSelectedKind,
			THelper
		>
	) => PipelineStage<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>;
	readonly halt: (error?: unknown) => PipelineHalt<TRunResult>;
	readonly pause?: (
		state: PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		options?: PipelinePauseOptions
	) => PipelinePaused<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>
	>;
	readonly isHalt: (value: unknown) => value is PipelineHalt<TRunResult>;
	readonly diagnostics: PipelineStageDiagnostics<TDiagnostic, TKind>;
	readonly extensions: {
		readonly lifecycles?: readonly string[];
	};
}

/**
 * Options passed to pipeline extension hooks.
 * @public
 */
export type PipelineExtensionLifecycle = string;

export interface PipelineExtensionHookOptions<TContext, TOptions, TArtifact> {
	readonly context: TContext;
	readonly options: TOptions;
	readonly artifact: TArtifact;
	readonly lifecycle: PipelineExtensionLifecycle;
}

/**
 * Result from a pipeline extension hook.
 * @public
 */
export interface PipelineExtensionHookResult<TArtifact> {
	readonly artifact?: TArtifact;
	readonly commit?: () => MaybePromise<void>;
	readonly rollback?: () => MaybePromise<void>;
}

/**
 * Metadata about an error during extension rollback.
 * @public
 */
export interface PipelineExtensionRollbackErrorMetadata {
	readonly name?: string;
	readonly message?: string;
	readonly stack?: string;
	readonly cause?: unknown;
}

/**
 * A pipeline extension hook function.
 * @public
 */
export type PipelineExtensionHook<TContext, TOptions, TArtifact> = (
	options: PipelineExtensionHookOptions<TContext, TOptions, TArtifact>
) => MaybePromise<PipelineExtensionHookResult<TArtifact> | void>;

/**
 * Hook registration returned by an extension.
 *
 * @public
 */
export interface PipelineExtensionHookRegistration<
	TContext,
	TOptions,
	TArtifact,
> {
	readonly lifecycle?: PipelineExtensionLifecycle;
	readonly hook: PipelineExtensionHook<TContext, TOptions, TArtifact>;
}

/**
 * A pipeline extension descriptor.
 * @public
 */
export interface PipelineExtension<TPipeline, TContext, TOptions, TArtifact> {
	readonly key?: string;
	register: (
		pipeline: TPipeline
	) => MaybePromise<
		PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact>
	>;
}

export type PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact> =
	| void
	| PipelineExtensionHook<TContext, TOptions, TArtifact>
	| PipelineExtensionHookRegistration<TContext, TOptions, TArtifact>;
/**
 * Options for creating an agnostic core pipeline.
 *
 * Checks strict standard concepts like "fragment" and "builder" at the door,
 * allowing purely configuration-driven helper kinds.
 *
 * @public
 */

export interface AgnosticPipelineOptions<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TUserState = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TUserState, TDiagnostic>,
	TKind extends HelperKind = HelperKind,
> {
	/**
	 * List of helper kinds to manage registered helpers for.
	 */
	readonly helperKinds: readonly TKind[];

	/**
	 * Map of helper keys that should be treated as "already satisfied" for dependency resolution.
	 * Keys are grouped by helper kind.
	 */
	readonly providedKeys?: Partial<Record<TKind, readonly string[]>>;

	readonly extensions?: {
		readonly lifecycles?: readonly string[];
	};

	readonly createContext: (options: TRunOptions) => TContext;
	readonly createError?: (code: string, message: string) => Error;

	/**
	 * Factory for initial state.
	 * Consumers can seed the state with arbitrary data needed by their stages.
	 */
	readonly createState?: (options: {
		readonly context: TContext;
		readonly options: TRunOptions;
	}) => TUserState;

	/**
	 * Factory for pipeline stages.
	 * If provided, this overrides the default agnostic stage composition.
	 * Use this to reinstate standard pipeline behaviors or implement custom flows.
	 */
	readonly createStages?: (
		deps: PipelineStageDependencies<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic,
			TRunResult,
			TKind
		>
	) => readonly PipelineStage<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>[];

	/**
	 * Adapts the generic run result (state) into the desired TRunResult.
	 */
	readonly createRunResult?: (options: {
		readonly artifact: TUserState;
		readonly diagnostics: readonly TDiagnostic[];
		readonly steps: readonly PipelineStep[];
		readonly context: TContext;
		readonly options: TRunOptions;
		readonly state: PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>;
	}) => TRunResult;

	/**
	 * Callback for observing diagnostics as they are added.
	 */
	readonly onDiagnostic?: (options: {
		readonly reporter: TReporter;
		readonly diagnostic: TDiagnostic;
	}) => void;

	readonly onExtensionRollbackError?: (options: {
		readonly error: unknown;
		readonly extensionKeys: readonly string[];
		readonly hookSequence: readonly string[];
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;

	readonly createConflictDiagnostic?: (options: {
		readonly helper: HelperDescriptor;
		readonly existing: HelperDescriptor;
		readonly message: string;
	}) => TDiagnostic;
	readonly createMissingDependencyDiagnostic?: (options: {
		readonly helper: HelperDescriptor;
		readonly dependency: string;
		readonly message: string;
	}) => TDiagnostic;
	readonly createUnusedHelperDiagnostic?: (options: {
		readonly helper: HelperDescriptor;
		readonly message: string;
	}) => TDiagnostic;
}
/**
 * A purely agnostic pipeline instance.
 *
 * @public
 */

export interface PipelineBase<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TPipeline = unknown,
> {
	readonly extensions: {
		use: (
			extension: PipelineExtension<
				TPipeline,
				TContext,
				TRunOptions,
				unknown
			>
		) => MaybePromise<unknown>;
	};

	/**
	 * Map of helper keys that should be treated as "already satisfied" for dependency resolution.
	 * Keys are grouped by helper kind.
	 */
	readonly providedKeys?: Record<string, readonly string[]>;

	/**
	 * Generic helper registration.
	 */
	use: <TInput, TOutput, TKind extends HelperKind>(
		helper: Helper<TContext, TInput, TOutput, TReporter, TKind>
	) => void;
}

export interface AgnosticPipeline<
	TRunOptions,
	TRunResult,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
> extends PipelineBase<
		TRunOptions,
		TContext,
		TReporter,
		AgnosticPipeline<TRunOptions, TRunResult, TContext, TReporter>
	> {
	/**
	 * Execute the pipeline.
	 */
	run: (options: TRunOptions) => MaybePromise<TRunResult>;
}

/**
 * A resumable pipeline instance.
 *
 * @public
 */
export interface ResumablePipeline<
	TRunOptions,
	TRunResult,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TState = unknown,
> extends PipelineBase<
		TRunOptions,
		TContext,
		TReporter,
		ResumablePipeline<TRunOptions, TRunResult, TContext, TReporter, TState>
	> {
	run: (
		options: TRunOptions
	) => MaybePromise<TRunResult | PipelinePaused<TState>>;
	resume: (
		snapshot: PipelinePauseSnapshot<TState>,
		resumeInput?: unknown
	) => MaybePromise<TRunResult | PipelinePaused<TState>>;
}
