import type {
	Edge,
	EffectContract,
	GraphContribution,
	GraphDeclaration,
	NodeContract,
	NodeExecutors,
} from '../../graph/types.js';
import type { GraphExtension } from '../../extensions/index.js';
import type { CheckedGraphExtensionRegistrations } from '../../extensions/types.js';
import type { PipelineProjection as PublicPipelineProjection } from '../../pipeline/types.js';
import {
	createPipeline,
	runPipeline,
	type Pipeline,
} from '../../pipeline/index.js';

type Inputs = Readonly<{ source: 'source' }>;
type Nodes = Readonly<{
	emit: NodeContract<
		'source',
		Readonly<{ emitted: true }>,
		'emit-failure',
		'email'
	>;
}>;
type Edges = readonly [];
type Effects = Readonly<{
	email: EffectContract<string, unknown, unknown, 'email-failure'>;
}>;
type Projection = Readonly<{ result: 'emit' }>;
type Capabilities = Readonly<{ token: 'capability' }>;
type AddedNodes = Readonly<{
	count: NodeContract<never, number, 'count-failure', 'email'>;
}>;
type AddedEdges = readonly [Edge<'emit', 'count'>];
type AddedProjection = Readonly<{ result: 'count' }>;
type CombinedNodes = Readonly<Nodes & AddedNodes>;
type CombinedEdges = readonly [...Edges, ...AddedEdges];

const declaration: GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> = {
	inputKeys: ['source'],
	nodes: {
		emit: {
			externalInputs: ['source'],
			effectKeys: ['email'],
			priority: 0,
		},
	},
	edges: [],
	effects: { email: {} },
	outputs: { result: 'emit' },
	policy: { maxConcurrency: 1 },
	executors: {
		emit: () => ({
			kind: 'success',
			output: { emitted: true },
			effects: [{ participant: 'email', payload: 'owner@example.com' }],
		}),
	},
};

const participants = {
	email: {
		prepare: () => ({ kind: 'success' as const, value: undefined }),
		commit: () => ({ kind: 'success' as const, value: undefined }),
		compensate: () => ({ kind: 'success' as const, value: undefined }),
	},
} as const;

const countExecutor: NodeExecutors<
	Inputs,
	CombinedNodes,
	CombinedEdges,
	Effects,
	Capabilities
>['count'] = ({ input }) => {
	const emitted: true = input.dependencies.emit.emitted;
	void emitted;
	return {
		kind: 'success',
		output: 42,
		effects: [{ participant: 'email', payload: 'counted' }],
	};
};

const numberContribution = {
	nodes: {
		count: {
			externalInputs: [],
			effectKeys: ['email'],
			priority: 0,
		},
	} as AddedNodes,
	edges: [{ from: 'emit', to: 'count' }] as unknown as AddedEdges,
	outputs: { result: 'count' } as AddedProjection,
	executors: { count: countExecutor },
} satisfies GraphContribution<AddedNodes, AddedEdges, AddedProjection>;

type CountConfiguration = Readonly<{
	label: 'counted';
	labels: readonly string[];
}>;

const countExtension: GraphExtension<
	CountConfiguration,
	typeof numberContribution
> = {
	contribute: ({ configuration }) => {
		const exact: 'counted' = configuration.label;
		// @ts-expect-error callback configuration is deeply immutable.
		configuration.labels.push('no');
		void exact;
		return numberContribution;
	},
};

const registrations = [
	{
		extension: countExtension,
		configuration: {
			label: 'counted' as const,
			labels: ['owned'],
		},
	},
] as const;

const checkedRegistrations: CheckedGraphExtensionRegistrations<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Capabilities,
	typeof registrations
> = registrations;

const pipeline = createPipeline({
	declaration,
	extensions: registrations,
	participants,
});

const basePipeline = createPipeline({ declaration, participants });

void checkedRegistrations;

type ExactAccumulatedProjection = PublicPipelineProjection<
	Nodes,
	Projection,
	typeof registrations
>;

const assertExactPipeline = (): void => {
	const exactAccumulatedProjection =
		undefined as unknown as ExactAccumulatedProjection;
	// @ts-expect-error accumulated projection has no open string index.
	void exactAccumulatedProjection.missing;
	const exact: Pipeline<
		Inputs,
		CombinedNodes,
		CombinedEdges,
		Effects,
		AddedProjection,
		Capabilities
	> = pipeline;
	void exact;
	// @ts-expect-error Pipeline generic relationships are invariant.
	const wrong: Pipeline<
		Inputs,
		Nodes,
		Edges,
		Effects,
		Projection,
		Capabilities
	> = pipeline;
	void wrong;
};

const assertRunResult = async (): Promise<void> => {
	const outcome = await runPipeline({
		pipeline,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
	});
	if (outcome.kind === 'succeeded') {
		const exact: Readonly<{ result: number }> = outcome.outputs;
		const numeric: number = outcome.outputs.result;
		// @ts-expect-error the exact accumulated projection has no missing key.
		void outcome.outputs.missing;
		// @ts-expect-error the contributed projection replaced the base output.
		const stale: Readonly<{ emitted: true }> = outcome.outputs.result;
		void numeric;
		void exact;
		void stale;
	}
};

const assertBaseProjection = async (): Promise<void> => {
	const outcome = await runPipeline({
		pipeline: basePipeline,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
	});
	if (outcome.kind === 'succeeded') {
		const exact: Readonly<{ result: Readonly<{ emitted: true }> }> =
			outcome.outputs;
		// @ts-expect-error the exact base projection has no missing key.
		void outcome.outputs.missing;
		void exact;
	}
};

const assertClosedInputs = (): void => {
	runPipeline({
		pipeline,
		// @ts-expect-error the Pipeline retains exact external input keys.
		inputs: { source: 'source', extra: true },
		capabilities: { token: 'capability' },
	});
	createPipeline({
		declaration,
		participants: {
			...participants,
			// @ts-expect-error participant admission is exact.
			extra: participants.email,
		},
	});
};

describe('v2 Pipeline public types', () => {
	it('preserves exact composition and run relationships', () => {
		expect(assertExactPipeline).toEqual(expect.any(Function));
		expect(assertRunResult).toEqual(expect.any(Function));
		expect(assertBaseProjection).toEqual(expect.any(Function));
		expect(assertClosedInputs).toEqual(expect.any(Function));
	});
});
