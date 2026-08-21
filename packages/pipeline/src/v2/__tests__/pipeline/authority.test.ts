import { deserialize, serialize } from 'node:v8';
import type { GraphDeclaration, NodeContract } from '../../graph/types.js';
import {
	createPipeline,
	runPipeline,
	type Pipeline,
} from '../../pipeline/index.js';

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{ node: NodeContract<never, 'done'> }>;
type Edges = readonly [];
type Effects = Readonly<Record<never, never>>;
type Projection = Readonly<{ result: 'node' }>;
type Capabilities = Readonly<Record<never, never>>;

const declaration: GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities
> = {
	inputKeys: [],
	nodes: {
		node: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [],
	effects: {},
	outputs: { result: 'node' },
	policy: { maxConcurrency: 1 },
	executors: {
		node: () => ({ kind: 'success', output: 'done', effects: [] }),
	},
};

const rejected = (pipeline: unknown): unknown =>
	runPipeline({
		pipeline: pipeline as Pipeline<
			Inputs,
			Nodes,
			Edges,
			Effects,
			Projection,
			Capabilities
		>,
		inputs: {},
		capabilities: {},
	});

describe('v2 Pipeline nominal authority', () => {
	it('uses one frozen null-prototype data token and non-enumerable witness', () => {
		const pipeline = createPipeline({ declaration, participants: {} });
		const symbols = Object.getOwnPropertySymbols(pipeline);
		const descriptor = Object.getOwnPropertyDescriptor(
			pipeline,
			symbols[0]!
		);
		const witness = Reflect.get(pipeline, symbols[0]!);

		expect(Object.getPrototypeOf(pipeline)).toBeNull();
		expect(Object.isFrozen(pipeline)).toBe(true);
		expect(Reflect.ownKeys(pipeline)).toEqual(['kind', symbols[0]]);
		expect(descriptor).toMatchObject({
			configurable: false,
			enumerable: false,
			writable: false,
		});
		expect(witness).toEqual({
			inputs: { value: undefined },
			nodes: { value: undefined },
			edges: { value: undefined },
			effects: { value: undefined },
			outputs: { value: undefined },
			capabilities: { value: undefined },
		});
		expect(JSON.stringify(pipeline)).toBe('{"kind":"pipeline"}');
	});

	it('rejects spread, clone, serialisation, reflection and proxy copies', () => {
		const pipeline = createPipeline({ declaration, participants: {} });
		const reflected = Object.freeze(
			Object.defineProperties(
				Object.create(null) as object,
				Object.getOwnPropertyDescriptors(pipeline)
			)
		);
		const candidates = [
			null,
			42,
			{ ...pipeline },
			deserialize(serialize(pipeline)),
			JSON.parse(JSON.stringify(pipeline)),
			new Proxy(pipeline, {}),
			reflected,
		];

		for (const candidate of candidates) {
			expect(rejected(candidate)).toMatchObject({
				kind: 'admission-failed',
				field: 'pipeline',
				error: { name: 'GraphSchedulerError', code: 'invalid-graph' },
			});
		}
		expect(
			runPipeline({ pipeline, inputs: {}, capabilities: {} })
		).toMatchObject({ kind: 'succeeded' });
	});
});
