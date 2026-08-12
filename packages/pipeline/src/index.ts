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
export type { PipelineHalt as Halt } from './core/types';

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
