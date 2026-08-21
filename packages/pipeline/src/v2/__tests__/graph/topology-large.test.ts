import { compileGraph } from '../../graph/index.js';
import { topologicalRanks } from '../../graph/topology.js';
import type { Edge, GraphValue, NodeContract } from '../../graph/types.js';

type Contract = NodeContract<string, GraphValue, unknown, string>;
type Executor = () => {
	readonly kind: 'success';
	readonly output: null;
	readonly effects: readonly never[];
};

const contract: Contract = {
	externalInputs: [],
	effectKeys: [],
	priority: 0,
};

const registries = (keys: readonly string[]) => {
	const nodes = Object.create(null) as Record<string, Contract>;
	const executors = Object.create(null) as Record<string, Executor>;
	for (const key of keys) {
		nodes[key] = contract;
		executors[key] = () => ({
			kind: 'success',
			output: null,
			effects: [],
		});
	}
	return { nodes, executors };
};

const topologyNodes = (keys: readonly string[]) =>
	new Map(keys.map((key) => [key, { key, contract, registrationOrder: 0 }]));

describe('linear graph topology traversals', () => {
	it('compiles a deterministic 15,000-node chain without recursive overflow', () => {
		const nodeCount = 15_000;
		const keys = Array.from({ length: nodeCount }, (_unused, index) =>
			String(index).padStart(5, '0')
		);
		const { nodes, executors } = registries(keys);
		const edges: Edge[] = keys.slice(1).map((to, index) => ({
			from: keys[index]!,
			to,
		}));

		const result = compileGraph({
			declaration: {
				inputKeys: [],
				nodes,
				edges,
				effects: {},
				outputs: { result: keys.at(-1)! },
				policy: { maxConcurrency: 1 },
				executors,
			},
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(
				result.diagnostics.map(({ code }) => code).join(', ')
			);
		}
		expect(result.graph.ranks[keys.at(-1)!]).toBe(14_999);
	}, 30_000);

	it('compiles 15,000 independent sources into one wide dependant', () => {
		const sourceCount = 15_000;
		const sources = Array.from(
			{ length: sourceCount },
			(_unused, index) => `source-${String(index).padStart(5, '0')}`
		);
		const sink = 'sink';
		const { nodes, executors } = registries([...sources, sink]);
		const edges: Edge[] = sources.map((from) => ({ from, to: sink }));

		const result = compileGraph({
			declaration: {
				inputKeys: [],
				nodes,
				edges,
				effects: {},
				outputs: { result: sink },
				policy: { maxConcurrency: 'unbounded' },
				executors,
			},
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(
				result.diagnostics.map(({ code }) => code).join(', ')
			);
		}
		expect(result.graph.ranks[sink]).toBe(1);
		expect(result.graph.incoming[sink]).toHaveLength(sourceCount);
		expect(new Set(result.graph.incoming[sink]).size).toBe(sourceCount);
	}, 30_000);

	it('returns one truthful witness for a deterministic 15,000-node SCC', () => {
		const nodeCount = 15_000;
		const keys = Array.from(
			{ length: nodeCount },
			(_unused, index) => `cycle-${String(index).padStart(5, '0')}`
		);
		const edges: Edge[] = keys.map((from, index) => ({
			from,
			to: keys[(index + 1) % nodeCount]!,
		}));

		const result = topologicalRanks(topologyNodes(keys), edges);

		expect(result.ranks.size).toBe(0);
		expect(result.cycles).toHaveLength(1);
		expect(result.cycles[0]!.component).toHaveLength(nodeCount);
		expect(result.cycles[0]!.witness).toHaveLength(nodeCount + 1);
		expect(result.cycles[0]!.witness[0]).toBe(
			result.cycles[0]!.witness.at(-1)
		);
		expect(result.blocked).toEqual([]);
	}, 30_000);
});
