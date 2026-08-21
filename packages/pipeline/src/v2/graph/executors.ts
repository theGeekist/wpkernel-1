import type { ErasedGraph } from './types.js';

const tables = new WeakMap<object, Readonly<Record<string, unknown>>>();

/**
 * Scheduler-only executor table registration.
 *
 * @internal
 * @param options           - Private executor ownership input.
 * @param options.graph     - Compiled graph identity.
 * @param options.executors - Complete keyed executor table.
 */
export const retainExecutors = (options: {
	readonly graph: object;
	readonly executors: Readonly<Record<string, unknown>>;
}): void => {
	const snapshot: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	for (const key of Object.keys(options.executors)) {
		snapshot[key] = options.executors[key];
	}
	tables.set(options.graph, Object.freeze(snapshot));
};

/**
 * Scheduler-only executor lookup.
 *
 * @internal
 * @param options       - Graph-owned executor lookup.
 * @param options.graph - Compiled graph authority.
 * @param options.key   - Canonical node key.
 */
export const getGraphExecutor = (options: {
	readonly graph: ErasedGraph;
	readonly key: string;
}): unknown => tables.get(options.graph)?.[options.key];
