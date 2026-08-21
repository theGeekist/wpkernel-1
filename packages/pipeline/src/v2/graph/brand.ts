/**
 * Private static provenance for compiled graph values.
 *
 * Runtime scheduling authority remains in the executor WeakMap. This witness
 * exists only so ordinary TypeScript literals cannot claim compilation and so
 * erased generic relationships survive inference without a callable phantom.
 */
export const compiledGraphBrand = Symbol('WPKernel compiled graph');

const invariantCell = Object.freeze({ value: undefined });
const typeWitness = Object.freeze({
	inputs: invariantCell,
	nodes: invariantCell,
	edges: invariantCell,
	effects: invariantCell,
	outputs: invariantCell,
	capabilities: invariantCell,
});

/**
 * Installs the real, data-only type witness before the graph is frozen.
 *
 * @param graph - Mutable graph projection awaiting its final freeze.
 */
export const attachCompiledGraphBrand = (graph: object): void => {
	Object.defineProperty(graph, compiledGraphBrand, {
		configurable: false,
		enumerable: false,
		value: typeWitness,
		writable: false,
	});
};
