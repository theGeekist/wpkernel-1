import type {
	CompiledGraphNode,
	Edge,
	EffectRegistry,
	Graph,
	GraphValue,
	NodeContract,
	NodeRegistry,
	OutputProjection,
} from './types.js';
import { attachCompiledGraphBrand } from './brand.js';
import {
	frozenSortedRecord,
	nullRecord,
	rawKeyCompare,
	sortedKeys,
} from './ordering.js';

interface TopologyNode {
	readonly key: string;
	readonly contract: NodeContract<string, GraphValue, unknown, string>;
	readonly registrationOrder: number;
}

const initialAdjacency = (nodes: ReadonlyMap<string, TopologyNode>) => {
	const incoming = new Map<string, Set<string>>();
	const outgoing = new Map<string, Set<string>>();
	for (const key of nodes.keys()) {
		incoming.set(key, new Set());
		outgoing.set(key, new Set());
	}
	return { incoming, outgoing };
};

export interface CycleEvidence {
	readonly component: readonly string[];
	readonly witness: readonly string[];
}

interface TarjanState {
	nextIndex: number;
	readonly indices: Map<string, number>;
	readonly lowLinks: Map<string, number>;
	readonly componentStack: string[];
	readonly onComponentStack: Set<string>;
	readonly components: string[][];
}

interface TraversalFrame {
	readonly key: string;
	readonly parent?: string;
	readonly neighbours: readonly string[];
	nextNeighbour: number;
}

const enterTraversal = (options: {
	readonly key: string;
	readonly parent?: string;
	readonly outgoing: ReadonlyMap<string, ReadonlySet<string>>;
	readonly state: TarjanState;
}): TraversalFrame => {
	const index = options.state.nextIndex;
	options.state.nextIndex += 1;
	options.state.indices.set(options.key, index);
	options.state.lowLinks.set(options.key, index);
	options.state.componentStack.push(options.key);
	options.state.onComponentStack.add(options.key);
	return {
		key: options.key,
		parent: options.parent,
		neighbours: sortedKeys(options.outgoing.get(options.key)!),
		nextNeighbour: 0,
	};
};

const finishTraversal = (frame: TraversalFrame, state: TarjanState): void => {
	if (frame.parent !== undefined) {
		state.lowLinks.set(
			frame.parent,
			Math.min(
				state.lowLinks.get(frame.parent)!,
				state.lowLinks.get(frame.key)!
			)
		);
	}
	if (state.lowLinks.get(frame.key) !== state.indices.get(frame.key)) {
		return;
	}
	const component: string[] = [];
	let member: string;
	do {
		member = state.componentStack.pop()!;
		state.onComponentStack.delete(member);
		component.push(member);
	} while (member !== frame.key);
	state.components.push(component.sort(rawKeyCompare));
};

const traverseFrom = (options: {
	readonly root: string;
	readonly outgoing: ReadonlyMap<string, ReadonlySet<string>>;
	readonly state: TarjanState;
}): void => {
	const frames = [
		enterTraversal({
			key: options.root,
			outgoing: options.outgoing,
			state: options.state,
		}),
	];
	while (frames.length > 0) {
		const frame = frames.at(-1)!;
		if (frame.nextNeighbour < frame.neighbours.length) {
			const dependant = frame.neighbours[frame.nextNeighbour]!;
			frame.nextNeighbour += 1;
			if (!options.state.indices.has(dependant)) {
				frames.push(
					enterTraversal({
						key: dependant,
						parent: frame.key,
						outgoing: options.outgoing,
						state: options.state,
					})
				);
			} else if (options.state.onComponentStack.has(dependant)) {
				options.state.lowLinks.set(
					frame.key,
					Math.min(
						options.state.lowLinks.get(frame.key)!,
						options.state.indices.get(dependant)!
					)
				);
			}
			continue;
		}
		frames.pop();
		finishTraversal(frame, options.state);
	}
};

const stronglyConnectedComponents = (
	nodes: ReadonlyMap<string, TopologyNode>,
	outgoing: ReadonlyMap<string, ReadonlySet<string>>
): readonly (readonly string[])[] => {
	const state: TarjanState = {
		nextIndex: 0,
		indices: new Map(),
		lowLinks: new Map(),
		componentStack: [],
		onComponentStack: new Set(),
		components: [],
	};
	for (const key of sortedKeys(nodes.keys())) {
		if (!state.indices.has(key)) {
			traverseFrom({ root: key, outgoing, state });
		}
	}
	return state.components;
};

const pathWithin = (options: {
	readonly from: string;
	readonly to: string;
	readonly members: ReadonlySet<string>;
	readonly outgoing: ReadonlyMap<string, ReadonlySet<string>>;
}): readonly string[] | undefined => {
	const queue: string[] = [options.from];
	let head = 0;
	const previous = new Map<string, string | undefined>([
		[options.from, undefined],
	]);
	while (head < queue.length) {
		const key = queue[head]!;
		head += 1;
		if (key === options.to) {
			const path: string[] = [];
			let cursor: string | undefined = key;
			while (cursor !== undefined) {
				path.push(cursor);
				cursor = previous.get(cursor);
			}
			return path.reverse();
		}
		for (const next of sortedKeys(options.outgoing.get(key)!)) {
			if (options.members.has(next) && !previous.has(next)) {
				previous.set(next, key);
				queue.push(next);
			}
		}
	}
	/* istanbul ignore next -- every member of an SCC reaches every other member */
	return undefined;
};

const cycleWitness = (
	component: readonly string[],
	outgoing: ReadonlyMap<string, ReadonlySet<string>>
): readonly string[] => {
	const members = new Set(component);
	for (const start of component) {
		for (const next of sortedKeys(outgoing.get(start)!)) {
			if (!members.has(next)) {
				continue;
			}
			if (next === start) {
				return Object.freeze([start, start]);
			}
			const path = pathWithin({
				from: next,
				to: start,
				members,
				outgoing,
			});
			return Object.freeze([start, ...path!]);
		}
	}
	/* istanbul ignore next -- callers pass only cyclic SCCs */
	throw new Error('A cyclic strongly connected component has no cycle.');
};

const addEdges = (
	adjacency: ReturnType<typeof initialAdjacency>,
	edges: readonly Edge[]
): void => {
	for (const edge of edges) {
		adjacency.incoming.get(edge.to)?.add(edge.from);
		adjacency.outgoing.get(edge.from)?.add(edge.to);
	}
};

const rankReadyNode = (options: {
	readonly key: string;
	readonly incoming: ReadonlyMap<string, ReadonlySet<string>>;
	readonly outgoing: ReadonlyMap<string, ReadonlySet<string>>;
	readonly remaining: Map<string, number>;
	readonly ranks: Map<string, number>;
	readonly ready: string[];
}): void => {
	let rank = 0;
	for (const predecessor of options.incoming.get(options.key)!) {
		rank = Math.max(rank, options.ranks.get(predecessor)! + 1);
	}
	options.ranks.set(options.key, rank);
	for (const dependant of options.outgoing.get(options.key)!) {
		const count = options.remaining.get(dependant)! - 1;
		options.remaining.set(dependant, count);
		if (count === 0) {
			options.ready.push(dependant);
		}
	}
};

/**
 * Finds exact longest-predecessor ranks without introducing execution waves.
 *
 * @param nodes - Validated graph nodes.
 * @param edges - Validated data dependencies.
 */
export const topologicalRanks = (
	nodes: ReadonlyMap<string, TopologyNode>,
	edges: readonly Edge[]
): {
	readonly ranks: ReadonlyMap<string, number>;
	readonly cycles: readonly CycleEvidence[];
	readonly blocked: readonly string[];
} => {
	const adjacency = initialAdjacency(nodes);
	addEdges(adjacency, edges);
	const remaining = new Map<string, number>(
		[...adjacency.incoming].map(([key, sources]) => [key, sources.size])
	);
	const ranks = new Map<string, number>();
	const ready = [...nodes.keys()].filter((key) => remaining.get(key) === 0);
	let head = 0;
	while (head < ready.length) {
		const current = ready[head]!;
		head += 1;
		rankReadyNode({
			key: current,
			incoming: adjacency.incoming,
			outgoing: adjacency.outgoing,
			remaining,
			ranks,
			ready,
		});
	}
	const unresolved = new Set(
		[...nodes.keys()].filter((key) => !ranks.has(key))
	);
	const components = stronglyConnectedComponents(nodes, adjacency.outgoing);
	const cyclic = components.filter(
		(component) =>
			component.length > 1 ||
			adjacency.outgoing.get(component[0]!)?.has(component[0]!)
	);
	const cyclicMembers = new Set(cyclic.flat());
	return {
		ranks,
		cycles: Object.freeze(
			cyclic.map((component) =>
				Object.freeze({
					component: Object.freeze([...component]),
					witness: cycleWitness(component, adjacency.outgoing),
				})
			)
		),
		blocked: Object.freeze(
			sortedKeys([...unresolved].filter((key) => !cyclicMembers.has(key)))
		),
	};
};

const compareCanonicalNodes = (
	ranks: ReadonlyMap<string, number>,
	left: TopologyNode,
	right: TopologyNode
): number => {
	const rankDifference = ranks.get(left.key)! - ranks.get(right.key)!;
	if (rankDifference !== 0) {
		return rankDifference;
	}
	const priorityDifference = right.contract.priority - left.contract.priority;
	if (priorityDifference !== 0) {
		return priorityDifference;
	}
	const keyDifference = rawKeyCompare(left.key, right.key);
	/* istanbul ignore else -- validated graph node keys are unique */
	if (keyDifference !== 0) {
		return keyDifference;
	}
	/* istanbul ignore next -- retained as the specified final deterministic tie */
	return left.registrationOrder - right.registrationOrder;
};

const freezeAdjacency = (options: {
	readonly nodes: readonly TopologyNode[];
	readonly edges: readonly Edge[];
	readonly ordinals: ReadonlyMap<string, number>;
}) => {
	const incoming = nullRecord<string[]>();
	const outgoing = nullRecord<string[]>();
	for (const node of options.nodes) {
		incoming[node.key] = [];
		outgoing[node.key] = [];
	}
	for (const edge of options.edges) {
		incoming[edge.to]!.push(edge.from);
		outgoing[edge.from]!.push(edge.to);
	}
	const frozenIncoming = nullRecord<readonly string[]>();
	const frozenOutgoing = nullRecord<readonly string[]>();
	for (const node of options.nodes) {
		const byOrdinal = (left: string, right: string) =>
			options.ordinals.get(left)! - options.ordinals.get(right)!;
		frozenIncoming[node.key] = Object.freeze(
			[...incoming[node.key]!].sort(byOrdinal)
		);
		frozenOutgoing[node.key] = Object.freeze(
			[...outgoing[node.key]!].sort(byOrdinal)
		);
	}
	return {
		incoming: Object.freeze(frozenIncoming),
		outgoing: Object.freeze(frozenOutgoing),
	};
};

/**
 * Creates the immutable topology projection after successful validation.
 *
 * @param options                       - Validated structural graph parts.
 * @param options.inputKeys             - Declared external input keys.
 * @param options.policy                - Required scheduler policy.
 * @param options.policy.maxConcurrency - Bounded or unbounded capacity.
 * @param options.nodes                 - Validated nodes by key.
 * @param options.edges                 - Validated edges.
 * @param options.outputs               - Validated typed output projections.
 * @param options.anchors               - Validated authoring anchors.
 * @param options.ranks                 - Exact canonical ranks.
 */
export const buildGraph = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
>(options: {
	readonly inputKeys: readonly (keyof TInputs & string)[];
	readonly policy: { readonly maxConcurrency: number | 'unbounded' };
	readonly nodes: ReadonlyMap<string, TopologyNode>;
	readonly edges: readonly Edge[];
	readonly outputs: Readonly<Record<string, string>>;
	readonly anchors: Readonly<Record<string, string>>;
	readonly ranks: ReadonlyMap<string, number>;
}): Graph<TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities> => {
	const ordered = [...options.nodes.values()].sort((left, right) =>
		compareCanonicalNodes(options.ranks, left, right)
	);
	const ordinals = new Map(
		ordered.map((node, ordinal) => [node.key, ordinal])
	);
	const edges = [...options.edges].sort(
		(left, right) =>
			ordinals.get(left.from)! - ordinals.get(right.from)! ||
			ordinals.get(left.to)! - ordinals.get(right.to)!
	);
	const compiledNodes = nullRecord<CompiledGraphNode>();
	const rankRecord = nullRecord<number>();
	const ordinalRecord = nullRecord<number>();
	for (const node of ordered) {
		const rank = options.ranks.get(node.key)!;
		const ordinal = ordinals.get(node.key)!;
		rankRecord[node.key] = rank;
		ordinalRecord[node.key] = ordinal;
		compiledNodes[node.key] = Object.freeze({
			key: node.key,
			externalInputs: Object.freeze(
				[...node.contract.externalInputs].sort(rawKeyCompare)
			),
			effectKeys: Object.freeze(
				[...node.contract.effectKeys].sort(rawKeyCompare)
			),
			priority: node.contract.priority,
			registrationOrder: node.registrationOrder,
			rank,
			ordinal,
		});
	}
	const adjacency = freezeAdjacency({ nodes: ordered, edges, ordinals });
	const graph = {
		kind: 'graph' as const,
		inputKeys: Object.freeze([...options.inputKeys].sort(rawKeyCompare)),
		nodes: Object.freeze(compiledNodes) as Graph<
			TInputs,
			TNodes,
			TEdges,
			TEffects,
			TProjection,
			TCapabilities
		>['nodes'],
		edges: Object.freeze(edges.map((edge) => Object.freeze({ ...edge }))),
		incoming: adjacency.incoming,
		outgoing: adjacency.outgoing,
		ranks: Object.freeze(rankRecord),
		ordinals: Object.freeze(ordinalRecord),
		outputs: frozenSortedRecord(
			Object.entries(options.outputs)
		) as TProjection,
		anchors: frozenSortedRecord(Object.entries(options.anchors)),
		policy: Object.freeze({ ...options.policy }),
	};
	attachCompiledGraphBrand(graph);
	return Object.freeze(graph) as Graph<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
};
