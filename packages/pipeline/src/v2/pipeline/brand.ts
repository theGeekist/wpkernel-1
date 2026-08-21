/** Private nominal provenance for configured Pipeline tokens. */
export const pipelineBrand = Symbol('WPKernel pipeline');

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
 * Installs the real data-only type witness before the token is frozen.
 *
 * @param pipeline - Pipeline token awaiting nominal provenance.
 */
export const attachPipelineBrand = (pipeline: object): void => {
	Object.defineProperty(pipeline, pipelineBrand, {
		configurable: false,
		enumerable: false,
		value: typeWitness,
		writable: false,
	});
};
