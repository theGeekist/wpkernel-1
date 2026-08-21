import { compileGraphOrThrow } from '../../graph/index.js';
import type {
	EffectRegistry,
	Graph,
	GraphDeclaration,
	GraphOutputs,
	GraphValue,
	NodeContract,
} from '../../graph/types.js';
import { scheduleGraph } from '../../scheduler/index.js';
import type {
	GraphScheduleOutcome,
	ScheduleGraphResult,
	ScheduledNodeOutcome,
} from '../../scheduler/types.js';

interface FailureA {
	readonly code: 'a';
}

interface FailureB {
	readonly code: 'b';
}

type Nodes = Readonly<{
	a: NodeContract<never, 'a-output', FailureA>;
	b: NodeContract<never, 'b-output', FailureB>;
}>;

type Projection = Readonly<{ result: 'a' }>;
type Outcome = GraphScheduleOutcome<
	Nodes,
	GraphOutputs<Nodes, Projection>,
	EffectRegistry
>;

type AuthorityInputs = Readonly<{ source: 'source' }>;
type AuthorityNodes = Readonly<{
	task: NodeContract<'source', 'complete', FailureA>;
}>;
type AuthorityEdges = readonly [];
type AuthorityEffects = Readonly<Record<never, never>>;
type AuthorityProjection = Readonly<{ result: 'task' }>;
type AuthorityCapabilities = Readonly<{ token: 'capability' }>;

const authorityDeclaration: GraphDeclaration<
	AuthorityInputs,
	AuthorityNodes,
	AuthorityEdges,
	AuthorityEffects,
	AuthorityProjection,
	AuthorityCapabilities
> = {
	inputKeys: ['source'],
	nodes: {
		task: { externalInputs: ['source'], effectKeys: [], priority: 0 },
	},
	edges: [],
	effects: {},
	outputs: { result: 'task' },
	policy: { maxConcurrency: 1 },
	executors: {
		task: () => ({
			kind: 'success' as const,
			output: 'complete',
			effects: [],
		}),
	},
};

const compiledAuthorityGraph = compileGraphOrThrow({
	declaration: authorityDeclaration,
});

const validScheduleResult = scheduleGraph({
	graph: compiledAuthorityGraph,
	inputs: { source: 'source' },
	capabilities: { token: 'capability' },
	participants: {},
});

type InferredScheduleOutcome = Awaited<typeof validScheduleResult>;

const assertGraphAuthority = (): void => {
	const exact: Graph<
		AuthorityInputs,
		AuthorityNodes,
		AuthorityEdges,
		AuthorityEffects,
		AuthorityProjection,
		AuthorityCapabilities
	> = compiledAuthorityGraph;
	const literal = {
		kind: 'graph' as const,
		inputKeys: ['source'] as const,
		nodes: {
			task: {
				key: 'task',
				externalInputs: ['source'] as const,
				effectKeys: [] as const,
				priority: 0,
				registrationOrder: 0,
				rank: 0,
				ordinal: 0,
			},
		},
		edges: [] as const,
		incoming: { task: [] as const },
		outgoing: { task: [] as const },
		ranks: { task: 0 },
		ordinals: { task: 0 },
		outputs: { result: 'task' },
		anchors: {},
		policy: { maxConcurrency: 1 as const },
	} as const;
	// @ts-expect-error only compilation can produce Graph authority.
	const fromLiteral: typeof exact = literal;
	const spread = { ...compiledAuthorityGraph };
	// @ts-expect-error spreading drops the private compiled Graph authority.
	const fromSpread: typeof exact = spread;
	const reconstructed = JSON.parse(
		JSON.stringify(compiledAuthorityGraph)
	) as typeof literal;
	// @ts-expect-error deserialised graph data is not compiled Graph authority.
	const fromReconstructed: typeof exact = reconstructed;
	void exact;
	void fromLiteral;
	void fromSpread;
	void fromReconstructed;
};

const assertScheduleInference = (): void => {
	const exact: ScheduleGraphResult<
		AuthorityNodes,
		AuthorityEffects,
		AuthorityProjection
	> = validScheduleResult;
	void exact;
};

const assertDirectScheduleArguments = (): void => {
	scheduleGraph({
		graph: compiledAuthorityGraph,
		// @ts-expect-error source is the exact graph input value, not any string.
		inputs: { source: 'other' },
		capabilities: { token: 'capability' } as const,
		participants: {},
	});
	scheduleGraph({
		graph: compiledAuthorityGraph,
		inputs: { source: 'source' } as const,
		// @ts-expect-error capabilities must match the compiled graph contract.
		capabilities: { token: 'other' } as const,
		participants: {},
	});
};

const assertDirectScheduleOutcome = (
	outcome: InferredScheduleOutcome
): void => {
	if (outcome.kind === 'succeeded') {
		const projected: 'complete' = outcome.outputs.result;
		// @ts-expect-error the output projection retains the declared node output.
		const wrongProjected: 'other' = outcome.outputs.result;
		void projected;
		void wrongProjected;
	}
	for (const node of outcome.nodes) {
		if (node.kind === 'succeeded' && node.node === 'task') {
			const output: 'complete' = node.output;
			// @ts-expect-error node task cannot expose another node's output.
			const wrongOutput: 'other' = node.output;
			void output;
			void wrongOutput;
		}
	}
	if (
		outcome.kind === 'failed' &&
		outcome.primaryFailure.kind === 'declared' &&
		outcome.primaryFailure.node === 'task'
	) {
		const failure: FailureA = outcome.primaryFailure.error;
		// @ts-expect-error node task retains its own declared failure type.
		const wrongFailure: FailureB = outcome.primaryFailure.error;
		void failure;
		void wrongFailure;
	}
};

const assertDeclaredFailureNarrowing = (outcome: Outcome): void => {
	if (outcome.kind !== 'failed') {
		return;
	}
	const failure = outcome.primaryFailure;
	if (failure.kind === 'declared' && failure.node === 'a') {
		const exact: FailureA = failure.error;
		// @ts-expect-error node a cannot expose node b's declared failure.
		const wrong: FailureB = failure.error;
		void exact;
		void wrong;
	}
	if (failure.kind === 'thrown' && failure.node === 'a') {
		// @ts-expect-error arbitrary JavaScript throws remain unknown.
		const notDeclared: FailureA = failure.error;
		void notDeclared;
	}
};

const assertNodeOutcomeNarrowing = (
	outcome: ScheduledNodeOutcome<Nodes>
): void => {
	if (outcome.kind === 'succeeded' && outcome.node === 'a') {
		const exact: 'a-output' = outcome.output;
		// @ts-expect-error node a cannot expose node b's output.
		const wrong: 'b-output' = outcome.output;
		void exact;
		void wrong;
	}
	if (
		outcome.kind === 'failed' &&
		outcome.failure.kind === 'declared' &&
		outcome.failure.node === 'b'
	) {
		const exact: FailureB = outcome.failure.error;
		void exact;
	}
};

describe('v2 scheduler public result types', () => {
	it('retain node-specific declared failures and outputs', () => {
		expect(assertDeclaredFailureNarrowing).toEqual(expect.any(Function));
		expect(assertNodeOutcomeNarrowing).toEqual(expect.any(Function));
		expect(assertGraphAuthority).toEqual(expect.any(Function));
		expect(assertScheduleInference).toEqual(expect.any(Function));
		expect(assertDirectScheduleArguments).toEqual(expect.any(Function));
		expect(assertDirectScheduleOutcome).toEqual(expect.any(Function));
		expect(null as GraphValue).toBeNull();
	});
});
