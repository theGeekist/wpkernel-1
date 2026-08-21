import { collectGraph } from './collect.js';
import { diagnostic } from './diagnostics.js';
import { retainExecutors } from './executors.js';
import { buildGraph, topologicalRanks } from './topology.js';
import type { ErasedCompileGraphResult, GraphDiagnostic } from './types.js';
import { validateGraph } from './validate.js';

export const compileErasedGraph = (options: {
	readonly declaration: unknown;
	readonly contributions?: unknown;
	readonly initialDiagnostics?: readonly GraphDiagnostic[];
}): ErasedCompileGraphResult => {
	const diagnostics = [...(options.initialDiagnostics ?? [])];
	const collected = collectGraph({
		declaration: options.declaration,
		contributions: options.contributions,
		diagnostics,
	});
	const validated = validateGraph(collected, diagnostics);
	const topology = topologicalRanks(validated.nodes, validated.edges);
	for (const cycle of topology.cycles) {
		diagnostics.push(
			diagnostic(
				'cycle',
				`Cyclic strongly connected component [${cycle.component.join(', ')}]; witness ${cycle.witness.join(' -> ')}.`,
				['edges']
			)
		);
	}
	if (topology.blocked.length > 0) {
		diagnostics.push(
			diagnostic(
				'blocked-by-cycle',
				`Nodes blocked by cyclic predecessors: ${topology.blocked.join(', ')}.`,
				['edges']
			)
		);
	}
	if (diagnostics.length > 0) {
		return { ok: false, diagnostics: Object.freeze(diagnostics) };
	}
	const graph = buildGraph({
		inputKeys: validated.inputKeys,
		policy: validated.policy,
		nodes: validated.nodes,
		edges: validated.edges,
		outputs: validated.outputs,
		anchors: validated.anchors,
		ranks: topology.ranks,
	});
	retainExecutors({ graph, executors: validated.executors });
	return { ok: true, graph };
};
