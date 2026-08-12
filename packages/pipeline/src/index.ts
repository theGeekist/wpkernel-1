// Main API exports
export { createHelper } from './core/helper';
export { createPipeline } from './standard-pipeline/createPipeline';
export { makePipeline } from './core/makePipeline';
export { makeResumablePipeline } from './core/makeResumablePipeline';
export { createPipelineExtension } from './core/createExtension';
export type { CreatePipelineExtensionOptions } from './core/createExtension';
export type { ErrorFactory } from './core/error-factory';

// Rollback utilities
export { createPipelineRollback } from './core/rollback';
export type {
	PipelineRollback,
	PipelineRollbackErrorMetadata,
} from './core/rollback';

// Type exports (all types consumers need)
export type {
	// Core pipeline types
	PipelineReporter,
	PipelineExtension,
	PipelineExtensionHook,
	PipelineExtensionHookOptions,
	PipelineExtensionHookResult,
	PipelineExtensionLifecycle,
	PipelineExtensionHookRegistration,
	PipelineExtensionRegisterOutput,
	PipelineDiagnostic,
	ConflictDiagnostic,
	MissingDependencyDiagnostic,
	UnusedHelperDiagnostic,

	// Helper types
	Helper,
	HelperApplyFn,
	HelperApplyResult,
	HelperNext,
	HelperDescriptor,
	HelperKind,
	HelperMode,
	CreateHelperOptions,
	HelperApplyOptions,
	// Utility types
	MaybePromise,
	PipelineStep,
	PipelineRunState,
	HelperExecutionSnapshot,
	PipelinePauseKind,
	PipelinePauseOptions,
	PipelinePauseSnapshot,
	PipelinePaused,
	PipelineExtensionRollbackErrorMetadata,
	AgnosticPipeline,
	ResumablePipeline,
	AgnosticPipelineOptions,
	PipelineStage,
	PipelineStageState,
	PipelineStageResult,
	PipelineStageDependencies,
	PipelineHelperStageOptions,
	PipelineRegisteredHelper,
	PipelineHelperRollback,
	PipelineStageDiagnostics,
	PipelineHalt,
} from './core/types';
import type { PipelineHalt } from './core/types';

/**
 * Concise alias for a terminal stage result.
 *
 * An error halt triggers rollback and rejects with its `error`. A result halt
 * settles successfully with its `result`; a bare halt settles successfully
 * with `undefined`. When both fields are present, the error is authoritative.
 *
 * @typeParam TRunResult - Successful pipeline result carried by a result halt.
 * @see {@link PipelineHalt}
 * @public
 */
export type Halt<TRunResult> = PipelineHalt<TRunResult>;

export type {
	Pipeline,
	CreatePipelineOptions,
	PipelineExecutionMetadata,
	FragmentFinalizationMetadata,
	StandardPipelineExtension,
} from './standard-pipeline/types';

// Re-export async utilities for helper authors
export {
	isPromiseLike,
	maybeAll,
	maybeThen,
	maybeTry,
} from './core/async-utils';
