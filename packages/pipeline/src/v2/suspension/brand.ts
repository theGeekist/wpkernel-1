/**
 * Private static provenance for process-local suspension projections.
 *
 * The live, single-use authority remains exclusively in the suspension
 * WeakMap. This witness contains no frontier, participant or configuration.
 */
export const suspensionBrand = Symbol('WPKernel suspension');

const invariantCell = Object.freeze({ value: undefined });
const typeWitness = Object.freeze({
	nodes: invariantCell,
	outputs: invariantCell,
	effects: invariantCell,
});

/**
 * Installs the real, data-only type witness before the projection is frozen.
 *
 * @param suspension - Mutable suspension projection awaiting its final freeze.
 */
export const attachSuspensionBrand = (suspension: object): void => {
	Object.defineProperty(suspension, suspensionBrand, {
		configurable: false,
		enumerable: false,
		value: typeWitness,
		writable: false,
	});
};
