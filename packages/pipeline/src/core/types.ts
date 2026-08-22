import type { PipelineRollbackErrorMetadata } from './rollback.js';

/**
 * A value that may be available synchronously or through a promise-compatible
 * thenable.
 *
 * @remarks
 * Pipeline operations preserve the synchronous path when every participant is
 * synchronous. Runtime adoption reads `then` exactly once. A callable value,
 * including one returned by a getter, is adopted with first-settlement
 * semantics; a throwing getter is a synchronous participant failure.
 *
 * @typeParam T - Settled value type.
 * @see {@link maybeThen}
 * @see {@link maybeAll}
 * @public
 */
export type MaybePromise<T> = T | PromiseLike<T>;

/**
 * Identifier for a helper execution phase, such as `fragment` or `builder`.
 *
 * @remarks
 * A serial programme accepts the fragment and builder kinds declared through
 * `CreateSerialPipelineOptions`. Dependencies are resolved within one kind,
 * never across the two registries.
 *
 * @public
 */
export type HelperKind = string;

/**
 * Registration policy for helpers that share a key.
 *
 * @remarks
 * `extend` keeps all registrations. `override` removes earlier registrations
 * for the same key. Registering a second override for that key is a fatal
 * configuration conflict.
 *
 * @public
 */
export type HelperMode = 'extend' | 'override';

/**
 * Minimal observer used by the pipeline for non-fatal warnings.
 *
 * @remarks
 * Reporting is observational. Reporter failures are contained and do not alter
 * registration, execution, rollback or run settlement.
 *
 * @public
 */
export interface PipelineReporter {
	/** Receives a human-readable warning and optional structured context. */
	warn?: (message: string, context?: unknown) => void;
}

/**
 * Stable metadata used to register, order and diagnose a helper.
 *
 * @remarks
 * Keys identify dependency targets within a helper kind. Dependency ordering
 * takes precedence over priority. Among otherwise ready helpers, higher
 * priority runs first, then key order, then registration order.
 *
 * @typeParam TKind - Literal union of helper kinds accepted by the pipeline.
 * @public
 */
export interface HelperDescriptor<TKind extends HelperKind = HelperKind> {
	/** Dependency and override identity within {@link kind}. */
	readonly key: string;
	/** Execution phase and registry containing this helper. */
	readonly kind: TKind;
	/** Duplicate-key registration policy. */
	readonly mode: HelperMode;
	/** Relative ordering hint; higher values run first when dependencies permit. */
	readonly priority: number;
	/** Helper keys that place this helper later in the serial execution order. */
	readonly dependsOn: readonly string[];
	/** Optional package or subsystem label used in diagnostics. */
	readonly origin?: string;
}

/**
 * Immutable invocation envelope passed to a helper.
 *
 * @typeParam TContext - Per-run context created by the pipeline.
 * @typeParam TInput - Stage-specific input supplied by the argument factory.
 * @typeParam TOutput - Current transformation value.
 * @typeParam TReporter - Reporter available both directly and through context.
 * @public
 */
export interface HelperApplyOptions<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
> {
	/** Per-run services and capabilities. */
	readonly context: TContext;
	/** Read-only input selected for this helper phase. */
	readonly input: TInput;
	/** Current output, including replacements produced upstream. */
	readonly output: TOutput;
	/** Reporter associated with the current run. */
	readonly reporter: TReporter;
}

/**
 * Type-only v1 descriptor for cleanup admitted after a helper succeeds.
 *
 * Returning this descriptor from {@link HelperApplyResult.rollback} requests
 * best-effort cleanup if later serial work fails. The callback remains
 * consumer-authored and callable by its owner. The descriptor grants no
 * evaluator admission or traversal authority; the compatibility evaluator
 * exclusively owns admission and reverse-order invocation.
 *
 * @typeParam TResult - Direct or recursively adopted cleanup result.
 *
 * @public
 */
export interface HelperRollback<TResult = unknown> {
	/** Stable machine-readable helper key for diagnostics. */
	readonly key?: string;
	/** Human-readable cleanup description for observers. */
	readonly label?: string;
	/**
	 * Cleanup invoked at most once by one evaluator-owned traversal.
	 *
	 * The result crosses the standard read-once thenable boundary: a direct
	 * value keeps cleanup synchronous, while a callable `then` is adopted before
	 * the evaluator continues to the next older cleanup.
	 */
	readonly run: () => MaybePromise<TResult>;
}

/**
 * Optional transformation and compensation produced by a helper.
 *
 * @remarks
 * Omitting `output` preserves the current output. A rollback is registered only
 * after the helper completes successfully. Registered rollbacks participate in
 * the pipeline's reverse execution and compensation chronology.
 *
 * @typeParam TOutput - Replacement output type for the helper phase.
 *
 * @public
 */
export interface HelperApplyResult<TOutput> {
	/** Replacement passed to downstream helpers and later stages. */
	readonly output?: TOutput;
	/** Compensation to execute if later work causes the run to fail. */
	readonly rollback?: HelperRollback;
}

/**
 * Explicit continuation for wrapping the remainder of a helper chain.
 *
 * Calling the continuation executes the remainder of a helper chain.
 *
 * @remarks
 * With no argument, downstream helpers receive the current output. Supplying an
 * argument replaces it. Repeated calls share the same downstream execution and
 * settlement while the owning helper participant remains unsettled. The
 * continuation is revoked when that participant settles; later calls fail
 * without executing downstream work. If a helper launches asynchronous
 * downstream work without awaiting it, the pipeline still waits for that work
 * before settling the helper or beginning rollback.
 *
 * @typeParam TOutput - Value threaded through the helper chain.
 *
 * @public
 */
export interface HelperNext<TOutput> {
	/** Continues with the current output. */
	(): MaybePromise<TOutput>;
	/**
	 * Continues with an explicit replacement output.
	 *
	 * @param output - Value supplied to the next helper in the chain.
	 */
	(output: TOutput): MaybePromise<TOutput>;
}

/**
 * Transformation invoked for one registered helper.
 *
 * @remarks
 * A helper may mutate its output, return an immutable replacement, wrap the
 * remainder of the chain through {@link HelperNext}, and register compensation
 * through {@link HelperApplyResult.rollback}. Returning `void` preserves the
 * current output and registers no rollback.
 *
 * @typeParam TContext - Per-run context type.
 * @typeParam TInput - Helper input type.
 * @typeParam TOutput - Helper output type.
 * @typeParam TReporter - Reporter type.
 * @param     options - Invocation context, input and current output.
 * @param     next    - Continuation for wrapping downstream helpers.
 * @returns A synchronous or asynchronous optional helper result.
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
 * Executable helper descriptor accepted by pipeline registration.
 *
 * @remarks
 * Helpers created by `createHelper` are frozen and retain their object identity
 * through registration and execution.
 *
 * @see {@link HelperDescriptor}
 * @see {@link HelperApplyFn}
 * @typeParam TContext - Per-run context type.
 * @typeParam TInput - Phase-specific input type.
 * @typeParam TOutput - Value transformed by the helper chain.
 * @typeParam TReporter - Reporter type available during execution.
 * @typeParam TKind - Literal helper kind represented by the descriptor.
 * @public
 */
export interface Helper<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
	TKind extends HelperKind = HelperKind,
> extends HelperDescriptor<TKind> {
	/** Executes this helper when its dependency position is reached. */
	readonly apply: HelperApplyFn<TContext, TInput, TOutput, TReporter>;
}

/**
 * Input accepted by `createHelper`.
 *
 * @remarks
 * Omitted metadata is normalised to `mode: 'extend'`, `priority: 0`, and an
 * empty dependency list. The dependency list is copied and frozen.
 *
 * @typeParam TContext - Per-run context type.
 * @typeParam TInput - Phase-specific input type.
 * @typeParam TOutput - Value transformed by the helper chain.
 * @typeParam TReporter - Reporter type available during execution.
 * @typeParam TKind - Literal helper kind represented by the descriptor.
 * @public
 */
export interface CreateHelperOptions<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
	TKind extends HelperKind = HelperKind,
> {
	/** Dependency and override identity within the helper kind. */
	readonly key: string;
	/** Pipeline phase in which the helper executes. */
	readonly kind: TKind;
	/** Duplicate-key policy. @defaultValue `'extend'` */
	readonly mode?: HelperMode;
	/** Relative ordering hint. @defaultValue `0` */
	readonly priority?: number;
	/** Prerequisite helper keys. @defaultValue `[]` */
	readonly dependsOn?: readonly string[];
	/** Optional provenance label used in diagnostics. */
	readonly origin?: string;
	/** Helper implementation. */
	readonly apply: HelperApplyFn<TContext, TInput, TOutput, TReporter>;
}

/**
 * Immutable public record of one executed helper.
 *
 * @remarks
 * Steps contain flattened descriptor metadata, not the helper object or its
 * executable function.
 *
 * @typeParam TKind - Helper-kind union represented by the step.
 * @public
 */
export interface PipelineStep<TKind extends HelperKind = HelperKind>
	extends HelperDescriptor<TKind> {
	/** Run-stable registration identity. */
	readonly id: string;
	/** Monotonic registration index within the helper kind. */
	readonly index: number;
}

/**
 * Legacy compatibility shape for an override registration conflict.
 *
 * @remarks
 * Static serial construction rejects duplicate overrides immediately and does
 * not emit this diagnostic during a run. The shape remains in the v1
 * diagnostic union for source compatibility with existing consumers.
 *
 * @typeParam TKind - Helper-kind union associated with the diagnostic.
 * @public
 */
export interface ConflictDiagnostic<TKind extends HelperKind = HelperKind> {
	/** Discriminant for exhaustive diagnostic handling. */
	readonly type: 'conflict';
	/** Conflicting helper key. */
	readonly key: string;
	/** Registration mode that caused the conflict. */
	readonly mode: HelperMode;
	/** Origins or keys of the competing registrations. */
	readonly helpers: readonly string[];
	/** Human-readable description. */
	readonly message: string;
	/** Helper kind containing the conflict. */
	readonly kind?: TKind;
}

/**
 * Fatal diagnostic emitted when a declared dependency cannot be satisfied.
 *
 * @remarks
 * Keys listed in `fragmentProvidedKeys` or `builderProvidedKeys` satisfy
 * external dependencies and therefore do not produce this diagnostic.
 *
 * @typeParam TKind - Helper-kind union associated with the diagnostic.
 * @public
 */
export interface MissingDependencyDiagnostic<
	TKind extends HelperKind = HelperKind,
> {
	/** Discriminant for exhaustive diagnostic handling. */
	readonly type: 'missing-dependency';
	/** Key of the helper declaring the dependency. */
	readonly key: string;
	/** Missing prerequisite key. */
	readonly dependency: string;
	/** Human-readable description. */
	readonly message: string;
	/** Helper kind whose graph was invalid. */
	readonly kind?: TKind;
	/** Origin or key identifying the affected helper. */
	readonly helper?: string;
	/** Dependencies declared by the affected helper at admission. */
	readonly dependsOn?: readonly string[];
}

/**
 * Diagnostic describing a registered helper that did not execute.
 *
 * @remarks
 * Serial ordering reports this diagnostic when registered helpers cannot enter
 * the executable order.
 *
 * @typeParam TKind - Helper-kind union associated with the diagnostic.
 * @public
 */
export interface UnusedHelperDiagnostic<TKind extends HelperKind = HelperKind> {
	/** Discriminant for exhaustive diagnostic handling. */
	readonly type: 'unused-helper';
	/** Registered helper key. */
	readonly key: string;
	/** Human-readable explanation of why it was considered unused. */
	readonly message: string;
	/** Helper kind containing the registration. */
	readonly kind?: TKind;
	/** Origin or key identifying the helper. */
	readonly helper?: string;
	/** Dependencies relevant to the non-execution diagnosis. */
	readonly dependsOn?: readonly string[];
}

/**
 * Built-in discriminated union of registration and execution diagnostics.
 *
 * @typeParam TKind - Helper-kind union represented by the diagnostics.
 * @public
 */
export type PipelineDiagnostic<TKind extends HelperKind = HelperKind> =
	| ConflictDiagnostic<TKind>
	| MissingDependencyDiagnostic<TKind>
	| UnusedHelperDiagnostic<TKind>;

/**
 * Default successful result returned by a pipeline.
 *
 * @remarks
 * `artifact` is the final user state. Diagnostics and steps are immutable views
 * of this run only. A custom result shape may be supplied through the required
 * `createRunResult` adapter in `CreateSerialPipelineOptions`.
 *
 * @typeParam TArtifact - Final artifact or user-state type.
 * @typeParam TDiagnostic - Diagnostic union collected by the run.
 * @public
 */
export interface PipelineRunState<
	TArtifact,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
> {
	/** Final artifact after all stages, hooks and output adoption. */
	readonly artifact: TArtifact;
	/** Diagnostics recorded during registration or this run. */
	readonly diagnostics: readonly TDiagnostic[];
	/** Helpers that actually executed, in execution order. */
	readonly steps: readonly PipelineStep[];
}

/**
 * Summary of registration and execution for one helper kind.
 *
 * @remarks
 * Serial compatibility finalisation exposes this metadata so consumers can
 * reason about conditional helper composition without receiving executable
 * helpers.
 *
 * @typeParam TKind - Helper kind represented by this summary.
 * @public
 */
export interface HelperExecutionSnapshot<
	TKind extends HelperKind = HelperKind,
> {
	/** Helper kind described by this snapshot. */
	readonly kind: TKind;
	/** Registration identities captured when the run began. */
	readonly registered: readonly string[];
	/** Registration identities that completed execution. */
	readonly executed: readonly string[];
	/** Registered identities that did not execute. */
	readonly missing: readonly string[];
}

/**
 * Application-defined classification for a pause boundary.
 *
 * @remarks
 * The runtime does not interpret pause kinds. Consumers may use them to route
 * process-local resumptions or discriminate payloads.
 * @public
 */
export type PipelinePauseKind = string;

/**
 * Metadata attached to a resumable pause.
 *
 * @remarks
 * All values are process-local metadata. They are not serialised, cloned or
 * validated by the pipeline.
 *
 * @see {@link PipelinePauseSnapshot}
 * @public
 */
export interface PipelinePauseOptions {
	/** Consumer-owned correlation value. */
	readonly token?: unknown;
	/** Application-defined pause classification. */
	readonly pauseKind?: PipelinePauseKind;
	/** Application-defined data needed to decide how to resume. */
	readonly payload?: unknown;
}

/**
 * Snapshot captured when a pipeline run pauses.
 *
 * A snapshot is a process-local, single-use capability owned by the resumable
 * pipeline instance that created it. Pass the exact snapshot object back to
 * that instance's `resume()` method. A copied, forged, foreign, previously
 * resumed, or concurrently resumed snapshot is rejected.
 *
 * `state` is a public projection for inspection. The runner retains the
 * authoritative continuation and transaction state privately. Neither the
 * snapshot nor its state is a serializable or durable workflow checkpoint.
 *
 * @typeParam TState - Public state projection available for inspection.
 * @see {@link ResumablePipeline.resume}
 *
 * @public
 */
export interface PipelinePauseSnapshot<TState> {
	/** Index of the stage that requested the pause and will be re-entered. */
	readonly stageIndex: number;
	/** Read-only public projection of the suspended stage state. */
	readonly state: TState;
	/** Consumer-owned correlation value copied from pause options. */
	readonly token?: unknown;
	/** Application-defined pause classification. */
	readonly pauseKind?: PipelinePauseKind;
	/** Epoch timestamp in milliseconds when the pause was created. */
	readonly createdAt: number;
	/** Consumer-owned pause payload. */
	readonly payload?: unknown;
}

/**
 * Discriminated result indicating that a resumable run suspended.
 *
 * @typeParam TState - Public stage-state projection captured by the snapshot.
 * @see {@link ResumablePipeline.resume}
 * @public
 */
export interface PipelinePaused<TState> {
	/** Runtime discriminant. */
	readonly __paused: true;
	/** Single-use capability required to resume the run. */
	readonly snapshot: PipelinePauseSnapshot<TState>;
}

/** @internal */
declare const pipelineStageStateBrand: unique symbol;

/**
 * Public state threaded through custom pipeline stages.
 *
 * Consumer stages may replace `userState` immutably by returning a spread of
 * the received state. Runner-owned fields are preserved by that spread without
 * becoming part of the public custom-stage contract.
 *
 * @remarks
 * The nominal brand prevents constructing a valid state from scratch. Return
 * the received state or derive a replacement from it. A resumed run re-enters
 * the stage that paused and exposes the caller's resume value through
 * {@link PipelineStageState.resumeInput}.
 *
 * @typeParam TRunOptions - Options supplied to `run()`.
 * @typeParam TUserState - User-owned state threaded through stages.
 * @typeParam TContext - Per-run context.
 * @typeParam TReporter - Reporter contained by the context.
 * @typeParam TDiagnostic - Diagnostic union collected by the run.
 * @example
 * ```ts
 * const increment = (state: PipelineStageState<Options, State, Context>) => ({
 *   ...state,
 *   userState: { ...state.userState, count: state.userState.count + 1 },
 * });
 * ```
 *
 * @public
 */
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
	/** Context created once for this run. */
	readonly context: TContext;
	/** Reporter associated with the current context. */
	readonly reporter: TReporter;
	/** Original options supplied to the run. */
	readonly runOptions: TRunOptions;
	/** User-owned state that stages may replace immutably. */
	readonly userState: TUserState;
	/** Helpers executed so far. */
	readonly steps: readonly PipelineStep[];
	/** Diagnostics recorded so far. */
	readonly diagnostics: readonly TDiagnostic[];
	/** Extension lifecycle names already executed by this run. */
	readonly executedLifecycles: ReadonlySet<string>;
	/** Execution summary by helper kind after helper stages complete. */
	readonly helperExecution?: ReadonlyMap<string, HelperExecutionSnapshot>;
	/** Zero-based index of the currently executing stage. */
	readonly stageIndex?: number;
	/** Value supplied to `resume()` when re-entering a paused stage. */
	readonly resumeInput?: unknown;
}

/**
 * Terminal result produced by a custom pipeline stage.
 *
 * A halt is either a failure carrying `error`, or a successful early result
 * carrying `result`. Use the stage dependency `halt(error)` for failures;
 * successful result halts may be returned directly.
 *
 * @remarks
 * Error halts initiate rollback. Successful result halts stop remaining stages
 * and return the supplied result without committing further extension work.
 * The two branches are mutually exclusive.
 *
 * @typeParam TRunResult - Successful early-result type.
 * @public
 */
export type PipelineHalt<TRunResult> =
	| {
			/** Runtime discriminant. */
			readonly __halt: true;
			/** Failure propagated after rollback completes. */
			readonly error: unknown;
			readonly result?: never;
			/** @internal */
			readonly __hasError?: true;
	  }
	| {
			/** Runtime discriminant. */
			readonly __halt: true;
			/** Successful result returned immediately from the run. */
			readonly result: TRunResult;
			readonly error?: never;
			/** @internal */
			readonly __hasError?: never;
	  };

/**
 * Complete result union accepted from a custom stage.
 *
 * @remarks
 * A stage either continues with state, suspends through
 * {@link PipelinePaused}, or terminates through {@link PipelineHalt}.
 *
 * @typeParam TState - State passed between stages.
 * @typeParam TRunResult - Successful halt result type.
 *
 * @public
 */
export type PipelineStageResult<TState, TRunResult> =
	| TState
	| PipelinePaused<TState>
	| PipelineHalt<TRunResult>;

/**
 * Synchronous-or-asynchronous unit in a custom stage composition.
 *
 * @remarks
 * Stages run sequentially in array order. A returned state is adopted before
 * the next stage. A pause or halt short-circuits the remaining composition.
 * Thrown and rejected errors initiate rollback.
 *
 * @typeParam TState - Stage-state facade.
 * @typeParam TRunResult - Successful early-result type.
 *
 * @public
 */
export type PipelineStage<TState, TRunResult> = (
	state: TState
) => MaybePromise<PipelineStageResult<TState, TRunResult>>;

/**
 * Registration metadata supplied to helper-stage argument factories.
 *
 * @typeParam THelper - Concrete helper type stored in the selected registry.
 *
 * @public
 */
export interface PipelineRegisteredHelper<THelper> {
	/** Original registered helper object. */
	readonly helper: THelper;
	/** Stable identity combining kind, key and registration index. */
	readonly id: string;
	/** Monotonic registration index within the kind. */
	readonly index: number;
}

/**
 * Helper and rollback pair captured after successful execution.
 *
 * @remarks
 * The pair retains helper identity so rollback-error observers receive the
 * exact helper whose compensation failed.
 *
 * @typeParam THelper - Concrete helper type retained by identity.
 *
 * @public
 */
export interface PipelineHelperRollback<THelper> {
	/** Original helper that produced the rollback. */
	readonly helper: THelper;
	/** Compensation registered by the helper result. */
	readonly rollback: HelperRollback;
}

/**
 * Adapters for constructing a typed helper-execution stage.
 *
 * @remarks
 * `makeArgs` selects phase-specific input and output. `writeOutput` adopts the
 * final helper-chain output into stage state. `onVisited` runs after the chain
 * and may attach execution metadata or report unused registrations. Omitting
 * adapters uses the agnostic defaults based on run options and user state.
 *
 * @typeParam TState - Complete stage-state type.
 * @typeParam TContext - Per-run context type.
 * @typeParam TInput - Input presented to this helper phase.
 * @typeParam TOutput - Value transformed by the helper chain.
 * @typeParam TReporter - Reporter available to helpers.
 * @typeParam TKind - Selected helper kind.
 * @typeParam THelper - Concrete helper type stored in the registry.
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
	/** Builds invocation arguments for each registered helper. */
	readonly makeArgs?: (
		state: TState
	) => (
		entry: PipelineRegisteredHelper<THelper>
	) => HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
	/** Adopts the chain's final output into stage state. */
	readonly writeOutput?: (state: TState, output: TOutput) => TState;
	/** Observes execution and returns the state passed to the next stage. */
	readonly onVisited?: (
		state: TState,
		visited: ReadonlySet<string>,
		registered: readonly PipelineRegisteredHelper<THelper>[],
		rollbacks: readonly PipelineHelperRollback<THelper>[],
		output: TOutput
	) => TState;
}

/**
 * Diagnostic capabilities available while composing custom stages.
 *
 * @remarks
 * Recorded diagnostics are appended to the current run and synchronously
 * offered to `onDiagnostic`. Observer failures are contained.
 *
 * @typeParam TDiagnostic - Diagnostic union accepted by the pipeline.
 * @typeParam TKind - Configured helper-kind union.
 *
 * @public
 */
export interface PipelineStageDiagnostics<
	TDiagnostic extends PipelineDiagnostic,
	TKind extends HelperKind,
> {
	/** Adds a fully constructed diagnostic to the current run. */
	readonly record: (diagnostic: TDiagnostic) => void;
	/** Records a standard unused-helper diagnostic. */
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
 * @remarks
 * These factories preserve runner bookkeeping that a hand-written stage cannot
 * reproduce safely. The default composition creates one helper stage for each
 * configured helper kind, in configured-kind order, followed by
 * {@link PipelineStageDependencies.finalizeResult}. A custom composition owns
 * stage ordering and must include every helper and extension lifecycle it wants
 * to execute.
 *
 * Lifecycle hooks execute sequentially in extension-registration order. Helper
 * stages resolve dependencies before execution. Commit callbacks execute in
 * forward execution order; rollback callbacks execute in reverse execution
 * order, and one rollback failure does not prevent later cleanup.
 *
 * @typeParam TRunOptions - Input supplied to a new run.
 * @typeParam TUserState - User-owned artifact threaded through stages.
 * @typeParam TContext - Per-run context containing the reporter.
 * @typeParam TReporter - Reporter available to helpers and diagnostics.
 * @typeParam TDiagnostic - Diagnostic union recorded by the runner.
 * @typeParam TRunResult - Terminal result returned by the pipeline.
 * @typeParam TKind - Configured helper-kind union.
 *
 * @see {@link PipelineStage}
 * @see {@link AgnosticPipelineOptions}
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
	/**
	 * Terminal stage that refreshes end-of-run diagnostics and creates the
	 * configured run result.
	 *
	 * @remarks
	 * Place this after stages that contribute helpers, diagnostics or artifact
	 * state. Lifecycle names configured but never executed are reported through
	 * the pipeline reporter when this stage settles the run.
	 */
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
	/**
	 * Creates a stage for one configured extension lifecycle.
	 *
	 * @remarks
	 * Hooks registered for the lifecycle run sequentially in registration order
	 * and thread their artifact replacements. Repeating the same lifecycle is a
	 * no-op after its first successful execution. If a hook fails, hooks already
	 * completed in that lifecycle roll back in reverse order before the error is
	 * propagated.
	 */
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
	/**
	 * Creates an explicit extension-commit boundary.
	 *
	 * @remarks
	 * Pending commit callbacks run sequentially in their original hook-execution
	 * order. Most compositions can rely on terminal settlement; use this stage
	 * only when a custom composition deliberately needs an earlier commit point.
	 */
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
	/**
	 * Creates a dependency-ordered stage for one configured helper kind.
	 *
	 * @remarks
	 * Higher priorities execute first, then keys sort alphabetically, then
	 * registration order breaks remaining ties. Dependencies constrain that
	 * order. Keys listed in `providedKeys` satisfy dependencies without adding an
	 * executable helper. Missing dependencies and conflicts become diagnostics;
	 * unusable helpers are not executed.
	 *
	 * The optional adapters support phase-specific inputs and state projections
	 * while retaining runner-managed rollback and execution metadata.
	 */
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
	/**
	 * Creates a failure halt. Returning it from a stage stops execution and
	 * initiates reverse-order rollback before the error is rethrown.
	 */
	readonly halt: (error: unknown) => PipelineHalt<TRunResult>;
	/**
	 * Suspends a resumable run at the current stage.
	 *
	 * @remarks
	 * Present only for a {@link ResumablePipeline}. The returned snapshot is a
	 * single-use capability tied to this pipeline instance and process. Resuming
	 * re-enters the same stage with `resumeInput` on state.
	 */
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
	/** Runtime type guard for terminal {@link PipelineHalt} values. */
	readonly isHalt: (value: unknown) => value is PipelineHalt<TRunResult>;
	/** Diagnostic recording helpers bound to the current run. */
	readonly diagnostics: PipelineStageDiagnostics<TDiagnostic, TKind>;
	/** Read-only extension configuration available to stage composers. */
	readonly extensions: {
		/** Lifecycle names recognised by this pipeline, in configured order. */
		readonly lifecycles?: readonly string[];
	};
}

/**
 * Name of an extension execution point in a stage composition.
 *
 * @remarks
 * Lifecycle names are application-defined strings. Configuring a lifecycle
 * makes it available to {@link PipelineStageDependencies.makeLifecycleStage};
 * it does not execute the lifecycle automatically in a custom composition.
 *
 * @public
 */
export type PipelineExtensionLifecycle = string;

/**
 * Immutable invocation data supplied to an extension hook.
 *
 * @typeParam TContext - Context created for the current run.
 * @typeParam TOptions - Original options supplied to the run.
 * @typeParam TArtifact - Extension-visible artifact at this lifecycle point.
 *
 * @public
 */
export interface PipelineExtensionHookOptions<TContext, TOptions, TArtifact> {
	/** Context shared by all stages, helpers and hooks in the run. */
	readonly context: TContext;
	/** Original run options. */
	readonly options: TOptions;
	/** Artifact after every preceding hook in this lifecycle has completed. */
	readonly artifact: TArtifact;
	/** Lifecycle currently being executed. */
	readonly lifecycle: PipelineExtensionLifecycle;
}

/**
 * Result from a pipeline extension hook.
 *
 * @remarks
 * All members are optional. Returning `void` or omitting `artifact` preserves
 * the current artifact. Commit and rollback callbacks describe side effects
 * prepared by the hook. The runner commits them in forward execution order on
 * successful settlement and rolls them back in reverse order after failure.
 *
 * @typeParam TArtifact - Extension-visible artifact type.
 *
 * @public
 */
export interface PipelineExtensionHookResult<TArtifact> {
	/** Replacement artifact passed to the next hook and written back to state. */
	readonly artifact?: TArtifact;
	/** Finalises the hook's prepared side effect after successful execution. */
	readonly commit?: () => MaybePromise<void>;
	/** Compensates the hook's prepared side effect after failure. */
	readonly rollback?: () => MaybePromise<void>;
}

/**
 * Metadata about an error during extension rollback.
 *
 * @remarks
 * The metadata describes the original run failure and the rollback callback
 * whose own failure is being reported. It is shared with helper rollback
 * observers so both mechanisms expose the same chronology vocabulary.
 *
 * @see {@link PipelineRollbackErrorMetadata}
 *
 * @public
 */
export type PipelineExtensionRollbackErrorMetadata =
	PipelineRollbackErrorMetadata;

/**
 * A pipeline extension hook function.
 *
 * @remarks
 * Hooks may remain synchronous or expose a callable `then`, which is read once
 * and adopted with first-settlement semantics. A throwing `then` getter is a
 * synchronous hook failure. Hooks within one lifecycle settle sequentially and
 * observe the artifact returned by the preceding hook.
 *
 * @typeParam TContext - Per-run context type.
 * @typeParam TOptions - Run-options type.
 * @typeParam TArtifact - Extension-visible artifact type.
 *
 * @see {@link PipelineExtensionHookResult}
 *
 * @public
 */
export type PipelineExtensionHook<TContext, TOptions, TArtifact> = (
	options: PipelineExtensionHookOptions<TContext, TOptions, TArtifact>
) => MaybePromise<PipelineExtensionHookResult<TArtifact> | void>;

/**
 * Hook registration returned by an extension.
 *
 * @remarks
 * Omitting `lifecycle` registers the hook at the runner's default lifecycle,
 * `after-fragments`. The lifecycle must be present in the pipeline's configured
 * lifecycle set to execute.
 *
 * @typeParam TContext - Per-run context type.
 * @typeParam TOptions - Run-options type.
 * @typeParam TArtifact - Extension-visible artifact type.
 *
 * @public
 */
export interface PipelineExtensionHookRegistration<
	TContext,
	TOptions,
	TArtifact,
> {
	/** Lifecycle at which the hook executes. Defaults to `after-fragments`. */
	readonly lifecycle?: PipelineExtensionLifecycle;
	/** Hook invoked when the selected lifecycle stage executes. */
	readonly hook: PipelineExtensionHook<TContext, TOptions, TArtifact>;
}

/**
 * A pipeline extension descriptor.
 *
 * Explicit keys must be unique within a pipeline instance. Omitting `key`
 * assigns a private generated key. Asynchronous registrations retain `use()`
 * call order regardless of the order in which registration promises settle.
 * A registration failure invalidates subsequent new runs.
 *
 * @typeParam TPipeline - Pipeline instance exposed during registration.
 * @typeParam TContext - Per-run context type used by the registered hook.
 * @typeParam TOptions - Run-options type used by the registered hook.
 * @typeParam TArtifact - Artifact type exposed to the registered hook.
 *
 * @see {@link PipelineExtensionHookRegistration}
 *
 * @public
 */
export interface PipelineExtension<TPipeline, TContext, TOptions, TArtifact> {
	/** Stable identity used for ordering and rollback diagnostics. */
	readonly key?: string;
	/**
	 * Registers zero or one lifecycle hook for this extension.
	 *
	 * Registration begins at `extensions.use()` time. A run waits for all
	 * registrations already in flight to reach quiescence, then captures an
	 * immutable hook snapshot.
	 */
	register: (
		pipeline: TPipeline
	) => MaybePromise<
		PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact>
	>;
}

/**
 * Value returned by extension registration: no hook, a hook using the default
 * lifecycle, or an explicit lifecycle registration.
 *
 * @typeParam TContext - Per-run context type.
 * @typeParam TOptions - Run-options type.
 * @typeParam TArtifact - Extension-visible artifact type.
 *
 * @public
 */
export type PipelineExtensionRegisterOutput<TContext, TOptions, TArtifact> =
	| void
	| PipelineExtensionHook<TContext, TOptions, TArtifact>
	| PipelineExtensionHookRegistration<TContext, TOptions, TArtifact>;
interface AgnosticPipelineBaseOptions<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TUserState = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TUserState, TDiagnostic>,
	TKind extends HelperKind = HelperKind,
> {
	/**
	 * Helper kinds accepted by {@link PipelineBase.use} and managed by the
	 * default stage composition, in execution order.
	 *
	 * @remarks
	 * A custom stage composition may choose a different execution order, but it
	 * can create helper stages only for kinds in this configured union.
	 */
	readonly helperKinds: readonly TKind[];

	/**
	 * Helper keys treated as already satisfied during dependency resolution,
	 * grouped by kind.
	 *
	 * @remarks
	 * Provided keys create no execution step and register no rollback. They are
	 * useful when a dependency is supplied by the host rather than another
	 * helper. Unknown kinds and keys have no effect.
	 */
	readonly providedKeys?: Partial<Record<TKind, readonly string[]>>;

	/** Extension lifecycle and artifact-boundary configuration. */
	readonly extensions?: {
		/**
		 * Lifecycle names available to custom stage composition. A configured name
		 * is reported if the run reaches finalisation without executing it.
		 */
		readonly lifecycles?: readonly string[];
		/**
		 * Boundary between user state and the artifact exposed to extension hooks.
		 *
		 * @remarks
		 * Use this when user state contains runner or domain bookkeeping alongside
		 * the public extension artifact. Without an adapter, hooks receive and
		 * replace the complete user state.
		 */
		readonly artifact?: {
			/** Projects the hook-visible artifact from current user state. */
			readonly read: (state: TUserState) => unknown;
			/** Writes a hook-produced artifact back into user state. */
			readonly write: (
				state: TUserState,
				artifact: unknown
			) => TUserState;
		};
	};

	/**
	 * Creates the context shared by one run.
	 *
	 * @remarks
	 * Called exactly once for each new run before state and stages are created.
	 * Resuming a paused run retains the original context.
	 */
	readonly createContext: (options: TRunOptions) => TContext;
	/**
	 * Creates pipeline-owned errors for diagnostic and registration failures.
	 * Defaults to a standard `Error` carrying the supplied code and message.
	 */
	readonly createError?: (code: string, message: string) => Error;
	/**
	 * Creates the initial user-owned state of every new run.
	 *
	 * @remarks
	 * Called after {@link AgnosticPipelineBaseOptions.createContext}. Resuming a
	 * paused run restores its captured state and does not call this factory.
	 */
	readonly createState: (options: {
		/** Context created for this run. */
		readonly context: TContext;
		/** Original run options. */
		readonly options: TRunOptions;
	}) => TUserState;

	/**
	 * Creates the ordered stage composition for a run.
	 *
	 * @remarks
	 * The default creates one helper stage for each configured helper kind, in
	 * configured-kind order, then finalises the result. Supplying this option
	 * replaces that composition completely. Include lifecycle stages explicitly
	 * when extensions should run at application-defined execution points.
	 *
	 * The returned array is captured for the run. Stages execute sequentially and
	 * short-circuit on pause, halt, throw or rejection.
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
	 * Observes diagnostics as they are added. Observer failures are contained and
	 * cannot change registration or run settlement.
	 */
	readonly onDiagnostic?: (options: {
		/** Reporter belonging to the current run. */
		readonly reporter: TReporter;
		/** Newly recorded diagnostic. */
		readonly diagnostic: TDiagnostic;
	}) => void;

	/**
	 * Observes an extension rollback callback that itself failed.
	 *
	 * @remarks
	 * Observer failures are contained. Remaining rollback callbacks still run.
	 * `extensionKeys` identifies the extension or shared rollback group associated
	 * with the failed callback; `errorMetadata` distinguishes original run failure
	 * from rollback failure and preserves their chronology.
	 */
	readonly onExtensionRollbackError?: (options: {
		/** Error thrown or rejected by the rollback callback. */
		readonly error: unknown;
		/** Extension keys associated with the failed rollback callback. */
		readonly extensionKeys: readonly string[];
		/** Original-failure and rollback-order metadata. */
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		/** Context of the failed run. */
		readonly context: TContext;
	}) => void;

	/**
	 * Observes a helper rollback callback that itself failed.
	 *
	 * @remarks
	 * The original helper object is preserved by identity. Observer failures are
	 * contained and remaining cleanup continues.
	 */
	readonly onHelperRollbackError?: (options: {
		/** Error thrown or rejected by the rollback callback. */
		readonly error: unknown;
		/** Original helper that registered the failed rollback. */
		readonly helper: unknown;
		/** Original-failure and rollback-order metadata. */
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		/** Context of the failed run. */
		readonly context: TContext;
	}) => void;

	/**
	 * Replaces construction of helper-conflict diagnostics.
	 *
	 * @remarks
	 * Supply this when `TDiagnostic` excludes the built-in conflict shape or adds
	 * required fields. The returned diagnostic is recorded without reshaping.
	 */
	readonly createConflictDiagnostic?: (options: {
		/** Later helper rejected by conflict resolution. */
		readonly helper: HelperDescriptor;
		/** Already selected helper with which it conflicts. */
		readonly existing: HelperDescriptor;
		/** Human-readable explanation produced by the runner. */
		readonly message: string;
	}) => TDiagnostic;
	/**
	 * Replaces construction of missing-dependency diagnostics. Supply this when
	 * `TDiagnostic` requires a domain-specific shape.
	 */
	readonly createMissingDependencyDiagnostic?: (options: {
		/** Helper whose dependency could not be satisfied. */
		readonly helper: HelperDescriptor;
		/** Missing helper or host-provided key. */
		readonly dependency: string;
		/** Human-readable explanation produced by the runner. */
		readonly message: string;
	}) => TDiagnostic;
	/**
	 * Replaces construction of unused-helper diagnostics. Supply this when
	 * `TDiagnostic` requires a domain-specific shape.
	 */
	readonly createUnusedHelperDiagnostic?: (options: {
		/** Registered helper that was not visited by its helper stage. */
		readonly helper: HelperDescriptor;
		/** Human-readable explanation produced by the runner. */
		readonly message: string;
	}) => TDiagnostic;
}

type AgnosticRunResultFactory<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
> = (options: {
	/** Final user state after the stage composition settles successfully. */
	readonly artifact: TUserState;
	/** Immutable diagnostics recorded during the run. */
	readonly diagnostics: readonly TDiagnostic[];
	/** Immutable helper execution trace. */
	readonly steps: readonly PipelineStep[];
	/** Context created for the run. */
	readonly context: TContext;
	/** Original run options. */
	readonly options: TRunOptions;
	/** Complete final stage state for specialised result projection. */
	readonly state: PipelineStageState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
}) => TRunResult;

type RunResultAdapter<TDefault, TResult, TFactory> = [TResult] extends [
	TDefault,
]
	? [TDefault] extends [TResult]
		? {
				/** Overrides projection of the default run-result shape. */
				readonly createRunResult?: TFactory;
			}
		: {
				/** Required adapter from final runner state to a custom result. */
				readonly createRunResult: TFactory;
			}
	: {
			/** Required adapter from final runner state to a custom result. */
			readonly createRunResult: TFactory;
		};

/**
 * Options for creating an agnostic core pipeline.
 *
 * A custom run result requires an explicit adapter. Omitting the adapter fixes
 * the result to the standard `{ artifact, diagnostics, steps }` shape.
 *
 * @remarks
 * `createContext` and `createState` define the per-run boundary. By default the
 * configured helper kinds execute in array order and the result is
 * {@link PipelineRunState}. `createStages` replaces that execution composition;
 * `createRunResult` replaces only the final public projection.
 *
 * @example
 * ```ts
 * const options: AgnosticPipelineOptions<
 *   { source: string },
 *   { reporter: PipelineReporter },
 *   PipelineReporter,
 *   { text: string }
 * > = {
 *   helperKinds: ['transform'],
 *   createContext: () => ({ reporter: { warn: console.warn } }),
 *   createState: ({ options }) => ({ text: options.source })
 * };
 * ```
 *
 * @typeParam TRunOptions - Input supplied to the returned pipeline's `run` method.
 * @typeParam TContext - Per-run context containing the reporter.
 * @typeParam TReporter - Reporter exposed by the context.
 * @typeParam TUserState - User-owned artifact threaded through stages.
 * @typeParam TDiagnostic - Diagnostic union recorded by the runner.
 * @typeParam TRunResult - Public successful run result.
 * @typeParam TKind - Helper-kind union accepted by the pipeline.
 *
 * @see {@link PipelineStageDependencies}
 *
 * @public
 */
export type AgnosticPipelineOptions<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TUserState = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TUserState, TDiagnostic>,
	TKind extends HelperKind = HelperKind,
> = AgnosticPipelineBaseOptions<
	TRunOptions,
	TContext,
	TReporter,
	TUserState,
	TDiagnostic,
	TRunResult,
	TKind
> &
	RunResultAdapter<
		PipelineRunState<TUserState, TDiagnostic>,
		TRunResult,
		AgnosticRunResultFactory<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic,
			TRunResult
		>
	>;
/**
 * Registration surface shared by agnostic and resumable pipelines.
 *
 * @remarks
 * Helper registration is synchronous and preserves object identity. Extension
 * registration may be asynchronous; each new run waits for registration to
 * reach quiescence, then captures an immutable extension snapshot. Registrations
 * made after a resumable run pauses affect later new runs, not that suspended
 * run.
 *
 * @typeParam TRunOptions - Options supplied to a new run and extension hooks.
 * @typeParam TContext - Per-run context containing the reporter.
 * @typeParam TReporter - Reporter exposed to helpers.
 * @typeParam TPipeline - Concrete pipeline passed to extension registration.
 * @typeParam TKind - Configured helper-kind union accepted by `use`.
 *
 * @public
 */
export interface PipelineBase<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TPipeline = unknown,
	TKind extends HelperKind = HelperKind,
> {
	/** Extension registration namespace. */
	readonly extensions: {
		/**
		 * Registers an extension. A run waits until registration reaches
		 * quiescence, then captures an immutable hook snapshot for that run.
		 *
		 * @remarks
		 * Calls are ordered by invocation, not asynchronous settlement. Explicit
		 * duplicate extension keys and registration failures invalidate subsequent
		 * new runs. An extension without an explicit key receives a private generated
		 * identity.
		 *
		 * @see {@link PipelineExtension}
		 */
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
	 * Registers a helper whose kind is one of the kinds configured at
	 * construction. Registration preserves the helper object's identity.
	 *
	 * @remarks
	 * Helper dependency and conflict resolution occurs when its helper stage
	 * executes, not at registration time. The configured `TKind` union prevents
	 * accidental registration of helper kinds that the pipeline cannot schedule.
	 *
	 * @see {@link Helper}
	 */
	use: <TInput, TOutput>(
		helper: Helper<TContext, TInput, TOutput, TReporter, TKind>
	) => void;
}

/**
 * Executable, non-suspending pipeline instance.
 *
 * @remarks
 * Each call creates fresh context and state, waits for pending extension
 * registration, captures the applicable registrations, then executes stages in
 * order. The return remains synchronous when the complete run is synchronous;
 * asynchronous helpers, hooks or stages promote it to a promise. Failures run
 * available compensation before they are rethrown or rejected.
 *
 * @typeParam TRunOptions - Input accepted by the pipeline's `run` method.
 * @typeParam TRunResult - Successful terminal result.
 * @typeParam TContext - Per-run context containing the reporter.
 * @typeParam TReporter - Reporter exposed to helpers and diagnostics.
 * @typeParam TKind - Configured helper-kind union accepted by `use`.
 *
 * @see {@link AgnosticPipelineOptions}
 * @see {@link ResumablePipeline}
 *
 * @public
 */
export interface AgnosticPipeline<
	TRunOptions,
	TRunResult,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TKind extends HelperKind = HelperKind,
> extends PipelineBase<
		TRunOptions,
		TContext,
		TReporter,
		AgnosticPipeline<TRunOptions, TRunResult, TContext, TReporter, TKind>,
		TKind
	> {
	/**
	 * Executes one run after pending extension registrations reach quiescence.
	 *
	 * @param options - Immutable input used to create context, state and result.
	 * @returns The configured result directly for a synchronous run, otherwise a
	 * promise for that result.
	 */
	run: (options: TRunOptions) => MaybePromise<TRunResult>;
}

/**
 * A resumable pipeline instance.
 *
 * Paused results expose a process-local, single-use snapshot capability.
 * Resume the exact object with the same pipeline instance. Registrations made
 * after a pause apply to later new runs and do not delay or invalidate the
 * suspended run.
 *
 * @typeParam TRunOptions - Input accepted by {@link ResumablePipeline.run}.
 * @typeParam TRunResult - Successful terminal result.
 * @typeParam TContext - Per-run context containing the reporter.
 * @typeParam TReporter - Reporter exposed to helpers and diagnostics.
 * @typeParam TState - Public state projection exposed by pause snapshots.
 * @typeParam TKind - Configured helper-kind union accepted by `use`.
 *
 * @example
 * ```ts
 * const result = await pipeline.run(options);
 * if ('paused' in result) {
 *   const resumed = await pipeline.resume(result.snapshot, userDecision);
 * }
 * ```
 *
 * @see {@link PipelinePaused}
 * @see {@link PipelinePauseSnapshot}
 *
 * @public
 */
export interface ResumablePipeline<
	TRunOptions,
	TRunResult,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TState = unknown,
	TKind extends HelperKind = HelperKind,
> extends PipelineBase<
		TRunOptions,
		TContext,
		TReporter,
		ResumablePipeline<
			TRunOptions,
			TRunResult,
			TContext,
			TReporter,
			TState,
			TKind
		>,
		TKind
	> {
	/**
	 * Starts a new run.
	 *
	 * @returns A successful result, or a paused value containing the single-use
	 * snapshot needed by {@link ResumablePipeline.resume}.
	 */
	run: (
		options: TRunOptions
	) => MaybePromise<TRunResult | PipelinePaused<TState>>;
	/**
	 * Continues the suspended run represented by `snapshot`.
	 *
	 * @remarks
	 * The exact snapshot object must be passed to the pipeline instance that
	 * created it. A snapshot is consumed by the first resume attempt and cannot be
	 * serialised, cloned, replayed or resumed concurrently. Execution re-enters
	 * the paused stage with `resumeInput`; it may complete or pause again with a
	 * fresh snapshot.
	 *
	 * @param snapshot    - Process-local capability returned by a prior pause.
	 * @param resumeInput - Optional value exposed as `state.resumeInput` while the
	 *                    paused stage is re-entered.
	 */
	resume: (
		snapshot: PipelinePauseSnapshot<TState>,
		resumeInput?: unknown
	) => MaybePromise<TRunResult | PipelinePaused<TState>>;
}
