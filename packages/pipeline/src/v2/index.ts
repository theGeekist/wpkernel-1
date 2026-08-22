/**
 * Pipeline v2's complete pre-root public surface.
 *
 * This barrel is deliberately hand-curated. It exposes graph authoring and the
 * functional evaluator, not the compilers and mutable interpreter seams that
 * make them work.
 *
 * @packageDocumentation
 */

export { createPipeline, runPipeline } from './pipeline/runtime.js';
export { abandon, resume } from './suspension/runtime.js';
export {
	adoptMaybePromise,
	isPromiseLike,
	maybeAll,
	maybeThen,
	maybeTry,
	processSequentially,
} from '../core/async-utils.js';
export type { AwaitedTuple } from '../core/async-utils.js';

export type {
	CreatePipelineOptions,
	Pipeline,
	PipelineAdmissionFailure,
	PipelineConfigurationFailure,
	PipelineConfigurationIssue,
	PipelineEdges,
	PipelineNodes,
	PipelineProjection,
	RunPipelineOptions,
	RunPipelineResult,
} from './pipeline/types.js';
export type {
	DependencyOutputs,
	Edge,
	EffectContract,
	EffectKey,
	EffectKeysOf,
	EffectRegistry,
	EffectRequest,
	EffectRequestFor,
	EffectRequestsFor,
	EffectTypes,
	ExecutionPolicy,
	ExternalKeysOf,
	FailureOf,
	GraphDeclaration,
	GraphDiagnostic,
	GraphDiagnosticCode,
	GraphOutputs,
	GraphScalar,
	GraphValue,
	MaybePromise,
	NodeContract,
	NodeExecutors,
	NodeInvocation,
	NodeKey,
	NodeRegistry,
	NodeResult,
	NodeTypes,
	OutputOf,
	OutputProjection,
	PauseRequest,
	Predecessors,
} from './graph/types.js';
export type {
	GraphContribution,
	GraphExtension,
	GraphExtensionFailure,
	GraphExtensionRegistration,
} from './extensions/types.js';
export type {
	MiddlewareEnteredOptions,
	MiddlewareInvocationOptions,
	MiddlewareResult,
	NodeMiddleware,
	NodeMiddlewareFor,
} from './middleware/types.js';
export type {
	EffectJournalEntry,
	EffectJournalFailure,
	EffectParticipant,
	EffectParticipants,
	EffectPhase,
	EffectPhaseResult,
} from './effects/types.js';
export type {
	EffectRunEvent,
	NodeRunEvent,
	RunEvent,
	RunObserver,
	RunObserverFailure,
	TerminalRunEvent,
} from './observers/types.js';
export type { NodeDiagnostic, RunDiagnostics } from './diagnostics/types.js';
export type { GraphSchedulerError } from './scheduler/errors.js';
export type {
	GraphNodeFailure,
	NodeOutcome,
	PauseRecord,
	RunFailure,
	RunOutcome,
} from './scheduler/types.js';
export type { SuspensionError } from './suspension/errors.js';
export type {
	AbandonmentOutcome,
	AbandonOptions,
	AbandonResult,
	ResumeOptions,
	ResumeResult,
	Suspension,
} from './suspension/types.js';
