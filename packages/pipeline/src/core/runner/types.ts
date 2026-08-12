import type { RegisteredHelper } from '../dependency-graph';
import type { ErrorFactory } from '../error-factory';
import type {
	Helper,
	HelperApplyResult,
	HelperApplyOptions,
	HelperKind,
	HelperNext,
	MaybePromise,
	PipelinePauseSnapshot,
	PipelinePaused,
	PipelineDiagnostic,
	PipelineHalt,
	PipelineStageDependencies,
	PipelineExtensionHookOptions,
	PipelineExtensionLifecycle,
	PipelineExtensionRollbackErrorMetadata,
	PipelineReporter,
	PipelineStep,
} from '../types';

import type { PipelineRollback } from '../rollback';
import type { AgnosticDiagnosticManager } from './diagnostics';
import type { ExtensionHookEntry, ExtensionHookExecution } from '../extensions';

export interface ExtensionLifecycleState<TContext, TOptions, TUserState> {
	readonly artifact: TUserState;
	readonly results: ExtensionHookExecution<TContext, TOptions, TUserState>[];
	readonly hooks: readonly ExtensionHookEntry<
		TContext,
		TOptions,
		TUserState
	>[];
}

export type RollbackJournalEntry<TContext, TOptions, TUserState> =
	| {
			readonly source: 'helper';
			readonly entries: readonly RollbackEntry<{
				readonly key: string;
			}>[];
	  }
	| {
			readonly source: 'extension';
			readonly state: ExtensionLifecycleState<
				TContext,
				TOptions,
				TUserState
			>;
	  };

export type ExtensionRollbackHandler = (options: {
	readonly error: unknown;
	readonly extensionKeys: readonly string[];
	readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
}) => void;

export interface AgnosticRunnerOptions<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
> {
	readonly createContext: (options: TRunOptions) => TContext;
	readonly createState: (options: {
		readonly context: TContext;
		readonly options: TRunOptions;
	}) => TUserState;
	readonly createError: ErrorFactory;
	readonly supportsPause?: boolean;
	readonly onExtensionRollbackError?: (options: {
		readonly error: unknown;
		readonly extensionKeys: readonly string[];
		readonly hookSequence: readonly string[];
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;
	readonly onHelperRollbackError?: (options: {
		readonly error: unknown;
		readonly helper: unknown;
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;
	readonly providedKeys?: Record<string, readonly string[]>;
}

/**
 * Mutable state captured while preparing a pipeline run.
 *
 * @category Pipeline
 * @internal
 */
export interface AgnosticRunContext<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
> {
	readonly state: AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	readonly pushStep: (entry: RegisteredHelper<unknown>) => void;
	readonly buildHookOptions: (
		state: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		lifecycle: PipelineExtensionLifecycle
	) => PipelineExtensionHookOptions<TContext, TRunOptions, TUserState>;
}

/**
 * Closed-world state threaded through composed pipeline programs.
 *
 * @category Pipeline
 * @internal
 */
export interface AgnosticState<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
> {
	readonly context: TContext;
	readonly reporter: TReporter;
	readonly runOptions: TRunOptions;
	readonly userState: TUserState;

	readonly helperOrders: Map<string, RegisteredHelper<unknown>[]>;
	/** Extension configuration captured when this run was prepared. */
	readonly extensionHooks: readonly ExtensionHookEntry<
		TContext,
		TRunOptions,
		TUserState
	>[];

	// Execution State
	readonly steps: PipelineStep[];
	readonly diagnostics: readonly TDiagnostic[];
	readonly diagnosticManager: AgnosticDiagnosticManager<
		TReporter,
		TDiagnostic
	>;
	readonly executedLifecycles: Set<string>;
	readonly stageIndex?: number;
	readonly resumeInput?: unknown;

	/** Rollback-bearing work recorded in forward execution order. */
	readonly rollbackJournal: RollbackJournalEntry<
		TContext,
		TRunOptions,
		TUserState
	>[];

	readonly extensionStack: ExtensionLifecycleState<
		TContext,
		TRunOptions,
		TUserState
	>[];
	readonly onExtensionRollbackError?: ExtensionRollbackHandler;
	readonly committedExtensionStates: Set<
		ExtensionLifecycleState<TContext, TRunOptions, TUserState>
	>;
}

// Re-export shared types
export type { ExtensionHookEntry };
export type RollbackEntry<THelper> = {
	readonly helper: THelper;
	readonly rollback: PipelineRollback;
};

export type Halt<TRunResult> = PipelineHalt<TRunResult>;

export type RollbackContext<TContext, TOptions, TUserState> = {
	readonly context: TContext;
	readonly rollbackJournal: readonly RollbackJournalEntry<
		TContext,
		TOptions,
		TUserState
	>[];
	readonly onExtensionRollbackError?: ExtensionRollbackHandler;
};

export type StageEnv<TState, TRunResult, TContext, TOptions, TUserState> = {
	pushStep: (entry: RegisteredHelper<unknown>) => void;
	toRollbackContext: (
		state: TState
	) => RollbackContext<TContext, TOptions, TUserState>;
	halt: (error?: unknown) => Halt<TRunResult>;
	isHalt: (value: unknown) => value is Halt<TRunResult>;
	onHelperRollbackError?: (options: {
		readonly error: unknown;
		readonly helper: unknown;
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;
};

export type PipelineStage<TState, TResult> = (
	state: TState | TResult | PipelinePaused<TState>
) => MaybePromise<TState | TResult | PipelinePaused<TState>>;

export type PipelineStepResult<TState, TRunResult> =
	| TState
	| PipelinePaused<TState>
	| Halt<TRunResult>;

/**
 * Dependency bundle consumed by {@link initAgnosticRunner}.
 *
 * @category Pipeline
 * @internal
 */
export interface AgnosticRunnerDependencies<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
> {
	readonly options: AgnosticRunnerOptions<
		TRunOptions,
		TUserState,
		TContext,
		TReporter
	>;

	// Generic registries for all helper kinds
	readonly helperRegistries: Map<string, RegisteredHelper<unknown>[]>;

	readonly diagnosticManager: AgnosticDiagnosticManager<
		TReporter,
		TDiagnostic
	>;

	readonly resolveRunResult: (state: {
		readonly diagnostics: readonly TDiagnostic[];
		readonly steps: readonly PipelineStep[];
		readonly context: TContext;
		readonly userState: TUserState;
		readonly options: TRunOptions;
		readonly state: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>;
	}) => TRunResult;

	readonly extensionHooks: ExtensionHookEntry<
		TContext,
		TRunOptions,
		TUserState
	>[];

	readonly extensionLifecycles?: readonly string[];

	readonly stages: (
		deps: PipelineStageDependencies<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic,
			TRunResult,
			string
		>
	) => PipelineStage<
		AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		Halt<TRunResult>
	>[];
}

export interface AgnosticRunner<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
> {
	readonly prepareContext: (
		runOptions: TRunOptions
	) => AgnosticRunContext<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	readonly executeRun: (
		context: AgnosticRunContext<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>
	) => MaybePromise<TRunResult>;
}

export interface AgnosticResumableRunner<
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
> {
	readonly prepareContext: (
		runOptions: TRunOptions
	) => AgnosticRunContext<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	readonly executeRun: (
		context: AgnosticRunContext<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>
	) => MaybePromise<
		| TRunResult
		| PipelinePaused<
				AgnosticState<
					TRunOptions,
					TUserState,
					TContext,
					TReporter,
					TDiagnostic
				>
		  >
	>;
	readonly executeResume: (
		snapshot: PipelinePauseSnapshot<
			AgnosticState<
				TRunOptions,
				TUserState,
				TContext,
				TReporter,
				TDiagnostic
			>
		>,
		resumeInput?: unknown
	) => MaybePromise<
		| TRunResult
		| PipelinePaused<
				AgnosticState<
					TRunOptions,
					TUserState,
					TContext,
					TReporter,
					TDiagnostic
				>
		  >
	>;
}

export type HelperInvokeOptions<
	THelper,
	TInput,
	TOutput,
	TContext,
	TReporter extends PipelineReporter,
> = {
	readonly helper: THelper;
	readonly args: HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
	readonly next: HelperNext<TOutput>;
};

export type HelperStageSpec<
	TState,
	TContext,
	TReporter extends PipelineReporter,
	TKind extends HelperKind,
	THelper extends Helper<TContext, TInput, TOutput, TReporter, TKind>,
	TInput,
	TOutput,
> = {
	readonly getOrder: (state: TState) => RegisteredHelper<THelper>[];
	readonly makeArgs: (
		state: TState
	) => (
		entry: RegisteredHelper<THelper>
	) => HelperApplyOptions<TContext, TInput, TOutput, TReporter>;
	readonly invoke?: (
		invokeOptions: HelperInvokeOptions<
			THelper,
			TInput,
			TOutput,
			TContext,
			TReporter
		>
	) => MaybePromise<HelperApplyResult<TOutput> | void>;
	readonly writeOutput?: (state: TState, output: TOutput) => TState;
	readonly writeRollbacks?: (
		state: TState,
		rollbacks: RollbackEntry<THelper>[],
		initialState: TState
	) => TState;
	readonly onVisited: (
		state: TState,
		visited: Set<string>,
		rollbacks: RollbackEntry<THelper>[],
		output: TOutput
	) => TState;
};

export type HelperRollbackPlan<
	TContext,
	TOptions,
	TUserState,
	THelper extends { key: string },
> = {
	readonly context: TContext;
	readonly rollbackContext: RollbackContext<TContext, TOptions, TUserState>;
	readonly helperRollbacks: readonly RollbackEntry<THelper>[];
	readonly onHelperRollbackError?: (options: {
		readonly error: unknown;
		readonly helper: { readonly key: string };
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => void;
};
