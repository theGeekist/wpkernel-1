// Main API exports
export { createHelper } from './core/helper.js';
export { createPipeline } from './standard-pipeline/createPipeline.js';
export { makePipeline } from './core/makePipeline.js';
export { makeResumablePipeline } from './core/makeResumablePipeline.js';
export { createPipelineExtension } from './core/createExtension.js';
export type { CreatePipelineExtensionOptions } from './core/createExtension.js';
export type { ErrorFactory } from './core/error-factory.js';

// Rollback utilities
export { createPipelineRollback } from './core/rollback.js';
export type {
	PipelineRollback,
	PipelineRollbackErrorMetadata,
} from './core/rollback.js';

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
} from './core/types.js';
import type { PipelineHalt } from './core/types.js';

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
} from './standard-pipeline/types.js';

// Re-export async utilities for helper authors
export {
	isPromiseLike,
	maybeAll,
	maybeThen,
	maybeTry,
} from './core/async-utils.js';
