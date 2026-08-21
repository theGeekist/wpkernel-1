import {
	createGraphExtensionRegistry,
	type GraphExtensionContribution,
} from '../../extensions/index.js';
import type {
	Edge,
	EffectContract,
	Graph,
	GraphDeclaration,
	NodeContract,
	NodeExecutors,
} from '../../graph/types.js';
import { scheduleGraph } from '../../scheduler/index.js';

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

const assertPreservedRegistryResult = async (): Promise<void> => {
	const registry = createGraphExtensionRegistry({ declaration });
	const result = await registry.compile();
	if (!result.ok) {
		return;
	}
	const exact: Graph<
		Inputs,
		Nodes,
		Edges,
		Effects,
		Projection,
		Capabilities
	> = result.graph;
	// @ts-expect-error the literal node registry remains closed.
	void result.graph.nodes.missing;
	scheduleGraph({
		graph: exact,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
		participants,
	});
};

const assertDirectDeclarationValidation = (): void => {
	createGraphExtensionRegistry<
		Inputs,
		Nodes,
		Edges,
		Effects,
		Projection,
		Capabilities
	>({
		declaration: {
			...declaration,
			executors: {
				// @ts-expect-error executor output remains node-specific.
				emit: () => ({
					kind: 'success',
					output: { wrong: true },
					effects: [],
				}),
			},
		},
	});
	createGraphExtensionRegistry<
		Inputs,
		Nodes,
		Edges,
		Effects,
		Projection,
		Capabilities
	>({
		declaration: {
			...declaration,
			executors: {
				// @ts-expect-error declared node failures retain their literal union.
				emit: () => ({ kind: 'failure', error: 'wrong-failure' }),
			},
		},
	});
	createGraphExtensionRegistry<
		Inputs,
		Nodes,
		Edges,
		Effects,
		Projection,
		Capabilities
	>({
		declaration: {
			...declaration,
			executors: {
				// @ts-expect-error node effects retain their permitted participant union.
				emit: () => ({
					kind: 'success',
					output: { emitted: true },
					effects: [{ participant: 'missing', payload: 'no' }],
				}),
			},
		},
	});
};

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
	},
	edges: [{ from: 'emit', to: 'count' }],
	outputs: { result: 'count' },
	executors: { count: countExecutor },
} satisfies GraphExtensionContribution<AddedNodes, AddedEdges, AddedProjection>;

describe('v2 graph extension public types', () => {
	it('retain heterogeneous graph authority across direct registry calls', () => {
		expect(assertPreservedRegistryResult).toEqual(expect.any(Function));
		expect(assertDirectDeclarationValidation).toEqual(expect.any(Function));
	});

	it('accumulates contributed projection and executor types', async () => {
		const registry = createGraphExtensionRegistry({ declaration }).use({
			extension: { contribute: () => numberContribution },
			configuration: undefined,
		});
		const compiled = registry.compile();
		expect(compiled).not.toBeInstanceOf(Promise);
		const result = await compiled;
		if (!result.ok) {
			throw new Error(
				`Expected graph compilation, received ${result.kind}.`
			);
		}
		const exact: Graph<
			Inputs,
			CombinedNodes,
			CombinedEdges,
			Effects,
			AddedProjection,
			Capabilities
		> = result.graph;
		const scheduled = scheduleGraph({
			graph: exact,
			inputs: { source: 'source' },
			capabilities: { token: 'capability' },
			participants,
		});
		expect(scheduled).not.toBeInstanceOf(Promise);
		const outcome = await scheduled;
		expect(outcome).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 42 },
		});
		if (outcome.kind === 'succeeded') {
			const numeric: number = outcome.outputs.result;
			// @ts-expect-error the contributed projection replaced the base output.
			const staleBaseOutput: Readonly<{ emitted: true }> =
				outcome.outputs.result;
			expect(numeric).toBe(42);
			void staleBaseOutput;
		}
	});
});
