import { compileGraphOrThrow } from '../../graph/index.js';
import type {
	Edge,
	EffectContract,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';
import type { NodeMiddlewareFor } from '../../middleware/types.js';
import { scheduleGraph } from '../../scheduler/index.js';

type Inputs = Readonly<{ source: 'source' }>;
type Nodes = Readonly<{
	parse: NodeContract<
		'source',
		Readonly<{ parsed: 'value' }>,
		'parse-failure'
	>;
	emit: NodeContract<
		never,
		Readonly<{ emitted: true }>,
		'emit-failure',
		'email'
	>;
}>;
type Edges = readonly [Edge<'parse', 'emit'>];
type Effects = Readonly<{
	email: EffectContract<
		Readonly<{ recipient: string }>,
		unknown,
		unknown,
		'email-failure'
	>;
	write: EffectContract<string, unknown, unknown, 'write-failure'>;
}>;
type Projection = Readonly<{ result: 'emit' }>;
type Capabilities = Readonly<{ token: 'capability' }>;
type State = Readonly<{ entered: true }>;

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
		parse: { externalInputs: ['source'], effectKeys: [], priority: 0 },
		emit: { externalInputs: [], effectKeys: ['email'], priority: 0 },
	},
	edges: [{ from: 'parse', to: 'emit' }],
	effects: { email: {}, write: {} },
	outputs: { result: 'emit' },
	policy: { maxConcurrency: 1 },
	executors: {
		parse: () => ({
			kind: 'success',
			output: { parsed: 'value' },
			effects: [],
		}),
		emit: () => ({
			kind: 'success',
			output: { emitted: true },
			effects: [],
		}),
	},
};

const graph = compileGraphOrThrow({ declaration });

const participants = {
	email: {
		prepare: () => ({ kind: 'success' as const, value: undefined }),
		commit: () => ({ kind: 'success' as const, value: undefined }),
		compensate: () => ({ kind: 'success' as const, value: undefined }),
	},
	write: {
		prepare: () => ({ kind: 'success' as const, value: undefined }),
		commit: () => ({ kind: 'success' as const, value: undefined }),
		compensate: () => ({ kind: 'success' as const, value: undefined }),
	},
} as const;

const middleware: NodeMiddlewareFor<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Capabilities,
	'emit',
	State
> = {
	node: 'emit',
	before({ invocation, node }) {
		const exactNode: 'emit' = node;
		const dependency: Readonly<{ parsed: 'value' }> =
			invocation.input.dependencies.parse;
		const capability: 'capability' = invocation.capabilities.token;
		// @ts-expect-error middleware receives no graph continuation.
		void invocation.next;
		void exactNode;
		void dependency;
		void capability;
		return {
			state: { entered: true },
			effects: [
				{
					participant: 'email',
					payload: { recipient: 'owner@example.com' },
				},
			],
		};
	},
	after({ output, state }) {
		const emitted: true = output.emitted;
		const entered: true = state.entered;
		void emitted;
		void entered;
		return [];
	},
	error({ error, state }) {
		void error;
		void state;
	},
	cancel({ reason, state }) {
		void reason;
		void state;
	},
};

const invalidEffect: NodeMiddlewareFor<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Capabilities,
	'emit',
	State
> = {
	node: 'emit',
	// @ts-expect-error emit admits only its declared email effect.
	before: () => ({
		state: { entered: true },
		effects: [
			{
				participant: 'write',
				payload: 'forbidden',
			},
		],
	}),
};

const assertScheduleRegistration = (): void => {
	scheduleGraph({
		graph,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
		participants,
		middleware: [middleware],
	});
};

const invalidDirectEffect = [
	{
		node: 'emit',
		before: () => ({
			state: { entered: true as const },
			effects: [{ participant: 'write' as const, payload: 'forbidden' }],
		}),
	},
] as const;

const invalidDirectOutput = [
	{
		node: 'emit',
		before: () => ({ state: { entered: true as const }, effects: [] }),
		after: (options: { readonly output: { readonly wrong: true } }) => {
			void options.output.wrong;
			return [];
		},
	},
] as const;

const invalidDirectState = [
	{
		node: 'emit',
		before: () => ({ state: { entered: true as const }, effects: [] }),
		after: (options: {
			readonly state: { readonly different: true };
			readonly output: { readonly emitted: true };
		}) => {
			void options.state.different;
			return [];
		},
	},
] as const;

const assertDirectScheduleValidation = (): void => {
	scheduleGraph({
		graph,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
		participants,
		// @ts-expect-error direct registration cannot emit an undeclared effect.
		middleware: invalidDirectEffect,
	});
	scheduleGraph({
		graph,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
		participants,
		// @ts-expect-error direct after output must match the selected node.
		middleware: invalidDirectOutput,
	});
	scheduleGraph({
		graph,
		inputs: { source: 'source' },
		capabilities: { token: 'capability' },
		participants,
		// @ts-expect-error direct phase state must match its before result.
		middleware: invalidDirectState,
	});
};

describe('v2 node middleware types', () => {
	it('retain node-specific invocation, output, state and effect unions', () => {
		expect(middleware.node).toBe('emit');
		expect(invalidEffect.node).toBe('emit');
		expect(assertScheduleRegistration).toEqual(expect.any(Function));
		expect(assertDirectScheduleValidation).toEqual(expect.any(Function));
	});
});
