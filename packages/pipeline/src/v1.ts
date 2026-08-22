/**
 * Immutable compatibility authoring for Pipeline v1 serial programmes.
 *
 * A programme declared here is evaluated as one node by the native Pipeline v2
 * runtime. The compatibility surface deliberately exposes no mutable runner,
 * suspension or rollback authority.
 *
 * @packageDocumentation
 */

export { createHelper } from './core/helper.js';
export { createSerialPipeline } from './standard-pipeline/serial-programme.js';
export { runPipeline } from './standard-pipeline/serial-runtime.js';

export type {
	ConflictDiagnostic,
	CreateHelperOptions,
	Helper,
	HelperApplyFn,
	HelperApplyOptions,
	HelperApplyResult,
	HelperDescriptor,
	HelperExecutionSnapshot,
	HelperKind,
	HelperMode,
	HelperNext,
	HelperRollback,
	MissingDependencyDiagnostic,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
	PipelineStep,
	UnusedHelperDiagnostic,
} from './core/types.js';

export type {
	FragmentFinalizationMetadata,
	PipelineExecutionMetadata,
} from './standard-pipeline/metadata.js';

export type {
	CreateSerialPipelineOptions,
	RunSerialPipelineOptions,
	SerialPipeline,
	SerialPipelineExtension,
	SerialPipelineHook,
	SerialPipelineHookOptions,
	SerialPipelineHookResult,
	SerialPipelineLifecycle,
	SerialNativeOutcome,
	SerialRunOutcome,
	SerialRunResult,
} from './standard-pipeline/serial-types.js';
