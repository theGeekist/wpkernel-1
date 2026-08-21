interface GraphRuntimeAuthority {
	readonly executors: Readonly<Record<string, unknown>>;
	readonly effectKeys: readonly string[];
}

const authorities = new WeakMap<object, GraphRuntimeAuthority>();

/**
 * Scheduler-only executor table registration.
 *
 * @internal
 * @param options            - Private executor ownership input.
 * @param options.graph      - Compiled graph identity.
 * @param options.executors  - Complete keyed executor table.
 * @param options.effectKeys - Complete declared effect-key set.
 */
export const retainExecutors = (options: {
	readonly graph: object;
	readonly executors: Readonly<Record<string, unknown>>;
	readonly effectKeys: readonly string[];
}): void => {
	const snapshot: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	for (const key of Object.keys(options.executors)) {
		snapshot[key] = options.executors[key];
	}
	authorities.set(
		options.graph,
		Object.freeze({
			executors: Object.freeze(snapshot),
			effectKeys: Object.freeze([...options.effectKeys]),
		})
	);
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
	readonly graph: object;
	readonly key: string;
}): unknown => authorities.get(options.graph)?.executors[options.key];

/**
 * Scheduler-only declared effect-key lookup.
 *
 * @internal
 * @param options       - Graph-owned effect lookup.
 * @param options.graph - Compiled graph authority.
 */
export const getGraphEffectKeys = (options: {
	readonly graph: object;
}): readonly string[] | undefined => authorities.get(options.graph)?.effectKeys;
