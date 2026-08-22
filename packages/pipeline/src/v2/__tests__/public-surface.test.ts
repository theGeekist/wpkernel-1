import {
	abandon,
	adoptMaybePromise,
	createPipeline,
	isPromiseLike,
	maybeAll,
	maybeThen,
	maybeTry,
	processSequentially,
	resume,
	runPipeline,
	type AbandonmentOutcome,
	type AbandonOptions,
	type AbandonResult,
	type CreatePipelineOptions,
	type DependencyOutputs,
	type Edge,
	type EffectContract,
	type EffectJournalEntry,
	type EffectJournalFailure,
	type EffectKey,
	type EffectKeysOf,
	type EffectParticipant,
	type EffectParticipants,
	type EffectPhase,
	type EffectPhaseResult,
	type EffectRegistry,
	type EffectRequest,
	type EffectRequestFor,
	type EffectRequestsFor,
	type EffectRunEvent,
	type EffectTypes,
	type ExecutionPolicy,
	type ExternalKeysOf,
	type FailureOf,
	type GraphContribution,
	type GraphDeclaration,
	type GraphDiagnostic,
	type GraphDiagnosticCode,
	type GraphExtension,
	type GraphExtensionFailure,
	type GraphExtensionRegistration,
	type GraphNodeFailure,
	type GraphOutputs,
	type GraphScalar,
	type GraphSchedulerError,
	type GraphValue,
	type MaybePromise,
	type MiddlewareEnteredOptions,
	type MiddlewareInvocationOptions,
	type MiddlewareResult,
	type NodeContract,
	type NodeDiagnostic,
	type NodeExecutors,
	type NodeInvocation,
	type NodeKey,
	type NodeMiddleware,
	type NodeMiddlewareFor,
	type NodeOutcome,
	type NodeRegistry,
	type NodeResult,
	type NodeRunEvent,
	type NodeTypes,
	type OutputOf,
	type OutputProjection,
	type PauseRecord,
	type PauseRequest,
	type Pipeline,
	type PipelineAdmissionFailure,
	type PipelineConfigurationFailure,
	type PipelineConfigurationIssue,
	type PipelineEdges,
	type PipelineNodes,
	type PipelineProjection,
	type Predecessors,
	type ResumeOptions,
	type ResumeResult,
	type RunDiagnostics,
	type RunEvent,
	type RunFailure,
	type RunObserver,
	type RunObserverFailure,
	type RunOutcome,
	type RunPipelineOptions,
	type RunPipelineResult,
	type AwaitedTuple,
	type Suspension,
	type SuspensionError,
	type TerminalRunEvent,
} from '../index.js';

type ExampleInputs = Readonly<{ source: string }>;
type ExampleNodes = Readonly<{
	uppercase: NodeContract<'source', string, never>;
}>;
type ExampleEffects = Readonly<Record<never, never>>;
type ExampleOutputs = Readonly<{ result: 'uppercase' }>;
type ExampleCapabilities = Readonly<{ locale: string }>;

const exampleDeclaration: GraphDeclaration<
	ExampleInputs,
	ExampleNodes,
	readonly [],
	ExampleEffects,
	ExampleOutputs,
	ExampleCapabilities
> = {
	inputKeys: ['source'],
	nodes: {
		uppercase: {
			externalInputs: ['source'],
			effectKeys: [],
			priority: 0,
		},
	},
	edges: [],
	effects: {},
	outputs: { result: 'uppercase' },
	policy: { maxConcurrency: 1 },
	executors: {
		uppercase: ({ input }) => ({
			kind: 'success',
			output: input.external.source.toUpperCase(),
			effects: [],
		}),
	},
};

const examplePipeline = createPipeline({
	declaration: exampleDeclaration,
	participants: {},
});

const exampleOutcome = runPipeline({
	pipeline: examplePipeline,
	inputs: { source: 'honest dataflow' },
	capabilities: { locale: 'en-SG' },
});
const awaitedTuple: AwaitedTuple<readonly [PromiseLike<1>, 2]> = [1, 2];
awaitedTuple[0] = 1;
type PublicSurface = readonly [
	AbandonmentOutcome<EffectRegistry>,
	AbandonOptions<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		EffectRegistry
	>,
	AbandonResult<EffectRegistry>,
	CreatePipelineOptions<
		Readonly<Record<string, GraphValue>>,
		NodeRegistry,
		readonly Edge[],
		EffectRegistry,
		OutputProjection<NodeRegistry>,
		unknown,
		readonly [],
		Readonly<Record<PropertyKey, never>>,
		readonly []
	>,
	DependencyOutputs<NodeRegistry, readonly Edge[], NodeKey>,
	EffectContract<GraphValue, unknown, unknown, unknown>,
	EffectJournalEntry<EffectRegistry>,
	EffectJournalFailure<EffectRegistry>,
	EffectParticipant<EffectContract<GraphValue, unknown, unknown, unknown>>,
	EffectParticipants<EffectRegistry>,
	EffectPhase,
	EffectPhaseResult<unknown, unknown>,
	EffectRequest<EffectRegistry>,
	EffectRequestFor<EffectRegistry, keyof EffectRegistry>,
	EffectRequestsFor<EffectRegistry, keyof EffectRegistry>,
	EffectRunEvent,
	EffectTypes<EffectContract<GraphValue, unknown, unknown, unknown>>,
	ExecutionPolicy,
	ExternalKeysOf<NodeContract<string, GraphValue>>,
	FailureOf<NodeContract<string, GraphValue>>,
	GraphContribution,
	GraphDeclaration<
		Readonly<Record<string, GraphValue>>,
		NodeRegistry,
		readonly Edge[],
		EffectRegistry,
		OutputProjection<NodeRegistry>,
		unknown
	>,
	GraphDiagnostic,
	GraphDiagnosticCode,
	GraphExtension<GraphValue>,
	GraphExtensionFailure,
	GraphExtensionRegistration,
	GraphNodeFailure<NodeRegistry>,
	GraphOutputs<NodeRegistry, OutputProjection<NodeRegistry>>,
	GraphScalar,
	GraphSchedulerError,
	MaybePromise<GraphValue>,
	MiddlewareEnteredOptions<NodeKey, unknown, unknown>,
	MiddlewareInvocationOptions<NodeKey, unknown>,
	MiddlewareResult<unknown, unknown>,
	NodeDiagnostic,
	NodeExecutors<
		Readonly<Record<string, GraphValue>>,
		NodeRegistry,
		readonly Edge[],
		EffectRegistry,
		unknown
	>,
	NodeInvocation<unknown, unknown, unknown>,
	NodeMiddleware<NodeKey, unknown, unknown, unknown, unknown>,
	NodeMiddlewareFor<
		Readonly<Record<string, GraphValue>>,
		NodeRegistry,
		readonly Edge[],
		EffectRegistry,
		unknown,
		NodeKey,
		unknown
	>,
	NodeOutcome<NodeRegistry>,
	NodeResult<GraphValue, unknown, unknown>,
	NodeRunEvent,
	NodeTypes<NodeContract<string, GraphValue>>,
	OutputOf<NodeContract<string, GraphValue>>,
	PauseRecord,
	PauseRequest,
	Pipeline<
		Readonly<Record<string, GraphValue>>,
		NodeRegistry,
		readonly Edge[],
		EffectRegistry,
		OutputProjection<NodeRegistry>,
		unknown
	>,
	PipelineAdmissionFailure,
	PipelineConfigurationFailure,
	PipelineConfigurationIssue,
	PipelineEdges<readonly Edge[], readonly []>,
	PipelineNodes<NodeRegistry, readonly []>,
	PipelineProjection<
		NodeRegistry,
		OutputProjection<NodeRegistry>,
		readonly []
	>,
	Predecessors<readonly Edge[], NodeKey>,
	ResumeOptions<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		EffectRegistry
	>,
	ResumeResult<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		EffectRegistry
	>,
	RunDiagnostics,
	RunEvent,
	RunFailure<NodeRegistry, EffectRegistry>,
	RunObserver,
	RunObserverFailure,
	RunOutcome<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		EffectRegistry
	>,
	RunPipelineOptions<
		Readonly<Record<string, GraphValue>>,
		NodeRegistry,
		readonly Edge[],
		EffectRegistry,
		OutputProjection<NodeRegistry>,
		unknown
	>,
	RunPipelineResult<
		NodeRegistry,
		EffectRegistry,
		OutputProjection<NodeRegistry>
	>,
	AwaitedTuple<readonly [1, PromiseLike<'settled'>]>,
	Suspension<
		NodeRegistry,
		Readonly<Record<string, GraphValue>>,
		EffectRegistry
	>,
	SuspensionError,
	TerminalRunEvent,
	EffectKey,
	EffectKeysOf<NodeContract<string, GraphValue>>,
	NodeRegistry,
	OutputProjection<NodeRegistry>,
];

describe('v2 public surface', () => {
	it('exports the evaluator operations at runtime', () => {
		expect({ abandon, createPipeline, resume, runPipeline }).toEqual({
			abandon,
			createPipeline,
			resume,
			runPipeline,
		});
		const fixture: PublicSurface | undefined = undefined;
		expect(fixture).toBeUndefined();
		expect(exampleOutcome).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'HONEST DATAFLOW' },
		});
	});

	it('exports the complete MaybePromise composition algebra', async () => {
		expect(adoptMaybePromise('direct')).toEqual({
			promise: null,
			value: 'direct',
		});
		expect(isPromiseLike(Promise.resolve('async'))).toBe(true);
		expect(maybeThen(2, (value) => value * 3)).toBe(6);
		expect(
			maybeTry(
				() => 'ok',
				() => 'recovered'
			)
		).toBe('ok');
		expect(maybeAll([1, 2, 3])).toEqual([1, 2, 3]);

		const visited: number[] = [];
		const settled = processSequentially([1, 2], (value) => {
			visited.push(value);
		});
		expect(isPromiseLike(settled)).toBe(false);
		expect(visited).toEqual([1, 2]);

		await expect(maybeAll([1, Promise.resolve(2)])).resolves.toEqual([
			1, 2,
		]);
	});
});
