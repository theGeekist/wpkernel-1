import fc from 'fast-check';
import { compileGraph, serializeGraph } from '../../graph/index.js';
import { topologicalRanks } from '../../graph/topology.js';
import type {
	Edge,
	ErasedCompileGraphResult,
	ErasedGraph,
	GraphValue,
	NodeContract,
} from '../../graph/types.js';

const keyArb = fc.oneof(
	{ depthIdentifier: 'node-key' },
	fc.constant('__proto__'),
	fc.constant('constructor'),
	fc.constant(''),
	fc.constant('\u0000'),
	fc.constant('\ud800'),
	fc.constant('\udfff'),
	fc.string({ maxLength: 8 })
);

interface DagModel {
	readonly keys: readonly string[];
	readonly edges: readonly Edge[];
	readonly priorities: ReadonlyMap<string, number>;
	readonly nodeOrder: readonly string[];
	readonly edgeOrder: readonly Edge[];
}

const dagArb: fc.Arbitrary<DagModel> = fc
	.uniqueArray(keyArb, { minLength: 1, maxLength: 8 })
	.chain((keys) => {
		const candidates = keys.flatMap((from, fromIndex) =>
			keys.slice(fromIndex + 1).map((to) => ({ from, to }) as const)
		);
		return fc
			.tuple(
				fc.subarray(candidates),
				fc.tuple(...keys.map(() => fc.integer({ min: -5, max: 5 }))),
				fc.shuffledSubarray(keys, {
					minLength: keys.length,
					maxLength: keys.length,
				})
			)
			.chain(([edges, priorities, nodeOrder]) =>
				fc
					.shuffledSubarray(edges, {
						minLength: edges.length,
						maxLength: edges.length,
					})
					.map((edgeOrder) => ({
						keys,
						edges,
						priorities: new Map(
							keys.map((key, index) => [
								key,
								priorities[index] ?? 0,
							])
						),
						nodeOrder,
						edgeOrder,
					}))
			);
	});

const compileUnknown = (declaration: unknown): ErasedCompileGraphResult =>
	(compileGraph as unknown as (options: unknown) => ErasedCompileGraphResult)(
		{ declaration }
	);

const nullRecord = <T>(): Record<string, T> =>
	Object.create(null) as Record<string, T>;

const declarationFor = (
	model: DagModel,
	options: {
		readonly nodes?: readonly string[];
		readonly edges?: readonly Edge[];
	} = {}
) => {
	const nodes = nullRecord<{
		readonly externalInputs: readonly string[];
		readonly effectKeys: readonly string[];
		readonly priority: number;
	}>();
	const executors = nullRecord<
		() => {
			readonly kind: 'success';
			readonly output: null;
			readonly effects: readonly never[];
		}
	>();
	for (const key of options.nodes ?? model.nodeOrder) {
		nodes[key] = {
			externalInputs: [],
			effectKeys: [],
			priority: model.priorities.get(key)!,
		};
		executors[key] = () => ({ kind: 'success', output: null, effects: [] });
	}
	const outputs = nullRecord<string>();
	outputs.result = model.keys.at(-1)!;
	return {
		inputKeys: [],
		nodes,
		edges: options.edges ?? model.edgeOrder,
		effects: nullRecord<never>(),
		outputs,
		anchors: nullRecord<string>(),
		policy: { maxConcurrency: 1 },
		executors,
	};
};

const rawCompareOracle = (left: string, right: string): number => {
	for (
		let index = 0;
		index < Math.min(left.length, right.length);
		index += 1
	) {
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) {
			return difference;
		}
	}
	return left.length - right.length;
};

const rankOracle = (model: DagModel): ReadonlyMap<string, number> => {
	const ranks = new Map(model.keys.map((key) => [key, 0]));
	for (let pass = 0; pass < model.keys.length; pass += 1) {
		for (const edge of model.edges) {
			ranks.set(
				edge.to,
				Math.max(ranks.get(edge.to)!, ranks.get(edge.from)! + 1)
			);
		}
	}
	return ranks;
};

const ordinalOracle = (model: DagModel, ranks: ReadonlyMap<string, number>) =>
	new Map(
		[...model.keys]
			.sort(
				(left, right) =>
					ranks.get(left)! - ranks.get(right)! ||
					model.priorities.get(right)! -
						model.priorities.get(left)! ||
					rawCompareOracle(left, right)
			)
			.map((key, ordinal) => [key, ordinal])
	);

const adjacencyOracle = (
	model: DagModel,
	ordinals: ReadonlyMap<string, number>,
	direction: 'incoming' | 'outgoing'
) => {
	const result = nullRecord<readonly string[]>();
	for (const key of model.keys) {
		const adjacent = model.edges
			.filter((edge) =>
				direction === 'incoming' ? edge.to === key : edge.from === key
			)
			.map((edge) => (direction === 'incoming' ? edge.from : edge.to))
			.sort((left, right) => ordinals.get(left)! - ordinals.get(right)!);
		result[key] = adjacent;
	}
	return result;
};

const serialisationOracle = (graph: ErasedGraph): string => {
	const keys = Object.keys(graph.nodes).sort(
		(left, right) => graph.ordinals[left]! - graph.ordinals[right]!
	);
	const sortedRecord = (record: Readonly<Record<string, string>>) =>
		Object.fromEntries(
			Object.entries(record).sort(([left], [right]) =>
				rawCompareOracle(left, right)
			)
		);
	return JSON.stringify({
		kind: graph.kind,
		inputKeys: graph.inputKeys,
		policy: graph.policy,
		nodes: keys.map((key) => graph.nodes[key]),
		edges: graph.edges,
		incoming: keys.map((key) => [key, graph.incoming[key]]),
		outgoing: keys.map((key) => [key, graph.outgoing[key]]),
		outputs: sortedRecord(graph.outputs),
		anchors: sortedRecord(graph.anchors),
	});
};

describe('v2 graph compiler properties', () => {
	it('matches independent rank, ordinal and adjacency oracles for DAGs', () => {
		fc.assert(
			fc.property(dagArb, (model) => {
				const result = compileUnknown(declarationFor(model));
				expect(result.ok).toBe(true);
				if (!result.ok) {
					return;
				}
				const ranks = rankOracle(model);
				const ordinals = ordinalOracle(model, ranks);
				for (const key of model.keys) {
					expect(result.graph.ranks[key]).toBe(ranks.get(key));
					expect(result.graph.ordinals[key]).toBe(ordinals.get(key));
				}
				expect(result.graph.incoming).toEqual(
					adjacencyOracle(model, ordinals, 'incoming')
				);
				expect(result.graph.outgoing).toEqual(
					adjacencyOracle(model, ordinals, 'outgoing')
				);
			}),
			{ seed: 20260821, numRuns: 200 }
		);
	});

	it('is declaration-order invariant and matches canonical serialisation oracle', () => {
		fc.assert(
			fc.property(dagArb, (model) => {
				const first = compileUnknown(declarationFor(model));
				const second = compileUnknown(
					declarationFor(model, {
						nodes: [...model.nodeOrder].reverse(),
						edges: [...model.edgeOrder].reverse(),
					})
				);
				expect(first.ok).toBe(true);
				expect(second.ok).toBe(true);
				if (!first.ok || !second.ok) {
					return;
				}
				const serialised = serializeGraph({ graph: first.graph });
				expect(serialised).toBe(
					serializeGraph({ graph: second.graph })
				);
				expect(serialised).toBe(serialisationOracle(first.graph));
			}),
			{ seed: 20260822, numRuns: 200 }
		);
	});

	it('returns genuine SCC witnesses whose every step is an edge', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(keyArb, { minLength: 1, maxLength: 8 }),
				(keys) => {
					const edges = keys.map((from, index) => ({
						from,
						to: keys[(index + 1) % keys.length]!,
					}));
					const nodes = new Map(
						keys.map((key) => [
							key,
							{
								key,
								contract: {
									externalInputs: [],
									effectKeys: [],
									priority: 0,
								} as NodeContract<
									string,
									GraphValue,
									unknown,
									string
								>,
								registrationOrder: 0,
							},
						])
					);
					const topology = topologicalRanks(nodes, edges);
					expect(topology.cycles).toHaveLength(1);
					const witness = topology.cycles[0]!.witness;
					expect(witness[0]).toBe(witness.at(-1));
					for (let index = 1; index < witness.length; index += 1) {
						expect(edges).toContainEqual({
							from: witness[index - 1],
							to: witness[index],
						});
					}
					const result = compileUnknown({
						...declarationFor({
							keys,
							edges,
							priorities: new Map(keys.map((key) => [key, 0])),
							nodeOrder: keys,
							edgeOrder: edges,
						}),
						edges,
					});
					expect(result.ok).toBe(false);
					if (!result.ok) {
						expect(
							result.diagnostics.some(
								({ code }) => code === 'cycle'
							)
						).toBe(true);
					}
				}
			),
			{ seed: 20260823, numRuns: 120 }
		);
	});
});
