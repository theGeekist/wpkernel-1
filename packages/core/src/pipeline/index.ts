/**
 * Domain-specific pipeline orchestrators and helpers for WPKernel.
 *
 * These orchestration helpers retain Pipeline v1's serial semantics. For
 * generic v1 primitives, import from '@wpkernel/pipeline/v1'.
 *
 * This module exports:
 * - createPipelineCommit, createPipelineRollback: Domain-specific commit helpers
 * - CorePipelineContext: Context bridge for framework integration
 * - TaskInput, PipelineTask: Task-related types
 */
export { createPipelineCommit, createPipelineRollback } from './helpers/commit';
export type { TaskInput, PipelineTask } from './helpers/commit';
export type {
	CorePipelineContext,
	CorePipelineRegistryBridge,
} from './helpers/context';
