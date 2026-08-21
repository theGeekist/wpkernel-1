import type {
	Graph,
	GraphValue,
	NodeRegistry,
	Edge,
	EffectRegistry,
	OutputProjection,
} from './types.js';
import { rawKeyCompare } from './ordering.js';

/** Serialises graph structure in canonical node-ordinal order. */
/**
 * @param options       - Compiled graph to serialise.
 * @param options.graph - Immutable graph structure.
 */
export const serializeGraph = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
>(options: {
	readonly graph: Graph<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
}): string => {
	const { graph } = options;
	const nodeKeys = Object.keys(graph.nodes).sort(
		(left, right) => graph.ordinals[left]! - graph.ordinals[right]!
	);
	const projection = Object.fromEntries(
		Object.entries(graph.outputs).sort(([left], [right]) =>
			rawKeyCompare(left, right)
		)
	);
	const anchors = Object.fromEntries(
		Object.entries(graph.anchors).sort(([left], [right]) =>
			rawKeyCompare(left, right)
		)
	);
	return JSON.stringify({
		kind: graph.kind,
		inputKeys: graph.inputKeys,
		policy: graph.policy,
		nodes: nodeKeys.map((key) => graph.nodes[key]),
		edges: graph.edges,
		incoming: nodeKeys.map((key) => [key, graph.incoming[key]]),
		outgoing: nodeKeys.map((key) => [key, graph.outgoing[key]]),
		outputs: projection,
		anchors,
	});
};
