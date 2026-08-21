import { createGraphExtensionRegistry } from '../../extensions/index.js';
import type {
	CompileGraphExtensionsResult,
	GraphExtensionContribution,
	GraphExtensionRegistry,
} from '../../extensions/types.js';
import type { ErasedGraphDeclaration } from '../../graph/types.js';
import { scheduleGraph } from '../../scheduler/index.js';
import { controlled } from '../../scheduler/scheduler.test-support.js';

const executor = (output: string) => () => ({
	kind: 'success' as const,
	output,
	effects: [],
});

const declaration = (): ErasedGraphDeclaration =>
	({
		inputKeys: [],
		nodes: {
			base: { externalInputs: [], effectKeys: [], priority: 0 },
		},
		edges: [],
		effects: {},
		outputs: { result: 'base' },
		anchors: { start: 'base' },
		policy: { maxConcurrency: 1 },
		executors: { base: executor('base') },
	}) as unknown as ErasedGraphDeclaration;

const contribution = (key: string): GraphExtensionContribution => ({
	nodes: {
		[key]: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [{ from: 'base', to: key }],
	outputs: { result: key },
	anchors: { finalise: key },
	executors: { [key]: executor(key) },
});

const expectCompiled = (
	result: CompileGraphExtensionsResult
): Extract<CompileGraphExtensionsResult, { readonly ok: true }> => {
	if (!result.ok) {
		throw new Error(`Expected compilation, received ${result.kind}.`);
	}
	return result;
};

describe('v2 graph extension registration', () => {
	it('compiles an extension-free generation synchronously', () => {
		const result = createGraphExtensionRegistry({
			declaration: declaration(),
		}).compile();

		expect(result).not.toBeInstanceOf(Promise);
		expectCompiled(result as CompileGraphExtensionsResult);
	});

	it.each([
		['non-record extension', 42],
		['missing callback', {}],
		['non-callable callback', { contribute: 42 }],
		[
			'throwing callback then getter',
			{
				contribute: () =>
					Object.defineProperty({}, 'then', {
						get: () => {
							throw new Error('then getter');
						},
					}),
			},
		],
	])('contains an invalid %s', (_label, extension) => {
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({ extension: extension as never, configuration: undefined });

		expect(registry.compile()).toMatchObject({
			ok: false,
			kind: 'extension-failed',
		});
	});

	it.each([
		['non-record', 42],
		[
			'hostile',
			new Proxy(
				{},
				{
					ownKeys() {
						throw new Error('executor keys');
					},
				}
			),
		],
	])('diagnoses %s contributed executor tables', (_label, executors) => {
		const extensionContribution = {
			executors,
		} as unknown as GraphExtensionContribution;
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: { contribute: () => extensionContribution },
			configuration: undefined,
		});

		expect(registry.compile()).toMatchObject({
			ok: false,
			kind: 'graph-invalid',
		});
	});

	it('applies synchronous contributions and lifecycle anchors in call order', () => {
		const calls: string[] = [];
		const base = createGraphExtensionRegistry({
			declaration: declaration(),
		});
		const first = base.use({
			extension: {
				contribute: () => {
					calls.push('first');
					return contribution('first');
				},
			},
			configuration: undefined,
		});
		const registry = first.use({
			extension: {
				contribute: () => {
					calls.push('second');
					return {
						...contribution('second'),
						edges: [{ from: 'first', to: 'second' }],
					};
				},
			},
			configuration: undefined,
		});

		const result = registry.compile();

		expect(result).not.toBeInstanceOf(Promise);
		const compiled = expectCompiled(result as CompileGraphExtensionsResult);
		expect(calls).toEqual(['first', 'second']);
		expect(compiled.graph.nodes.first?.registrationOrder).toBe(1);
		expect(compiled.graph.nodes.second?.registrationOrder).toBe(2);
		expect(compiled.graph.incoming.second).toEqual(['first']);
		expect(compiled.graph.outputs.result).toBe('second');
		expect(compiled.graph.anchors.finalise).toBe('second');
	});

	it('captures one tail and applies async contributions by registration order', async () => {
		const first = controlled<GraphExtensionContribution>();
		const second = controlled<GraphExtensionContribution>();
		const calls: string[] = [];
		const base = createGraphExtensionRegistry({
			declaration: declaration(),
		});
		const firstRegistration = base.use({
			extension: {
				contribute: () => {
					calls.push('first');
					return first.promise;
				},
			},
			configuration: undefined,
		});
		const registry = firstRegistration.use({
			extension: {
				contribute: () => {
					calls.push('second');
					return second.promise;
				},
			},
			configuration: undefined,
		});
		const captured = registry.compile();
		registry.use({
			extension: {
				contribute: () => {
					calls.push('later');
					return contribution('later');
				},
			},
			configuration: undefined,
		});

		second.resolve({
			...contribution('second'),
			edges: [{ from: 'first', to: 'second' }],
		});
		first.resolve(contribution('first'));
		const compiled = expectCompiled(await captured);

		expect(calls).toEqual(['first', 'second', 'later']);
		expect(compiled.graph.nodes.first?.registrationOrder).toBe(1);
		expect(compiled.graph.nodes.second?.registrationOrder).toBe(2);
		expect(compiled.graph.nodes.later).toBeUndefined();
	});

	it('drains every captured failure and selects the lowest sequence', async () => {
		const first = controlled<GraphExtensionContribution>();
		const second = controlled<GraphExtensionContribution>();
		const firstError = new Error('first');
		const secondError = new Error('second');
		const base = createGraphExtensionRegistry({
			declaration: declaration(),
		});
		const firstRegistration = base.use({
			extension: { contribute: () => first.promise },
			configuration: undefined,
		});
		const registry = firstRegistration.use({
			extension: { contribute: () => second.promise },
			configuration: undefined,
		});
		const result = registry.compile();
		let settled = false;
		void Promise.resolve(result).then(() => {
			settled = true;
		});

		second.reject(secondError);
		await Promise.resolve();
		expect(settled).toBe(false);
		first.reject(firstError);

		await expect(result).resolves.toEqual({
			ok: false,
			kind: 'extension-failed',
			primaryFailure: { registrationOrder: 1, error: firstError },
			failures: [
				{ registrationOrder: 1, error: firstError },
				{ registrationOrder: 2, error: secondError },
			],
		});
	});

	it('owns a contribution when its callback settles', () => {
		const nodes = {
			owned: { externalInputs: [], effectKeys: [], priority: 7 },
		};
		const extensionContribution = {
			nodes,
			edges: [{ from: 'base', to: 'owned' }],
			outputs: { result: 'owned' },
			executors: { owned: executor('owned') },
		};
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: { contribute: () => extensionContribution },
			configuration: undefined,
		});
		nodes.owned.priority = -100;
		extensionContribution.edges[0]!.to = 'missing';

		const compiled = expectCompiled(
			registry.compile() as CompileGraphExtensionsResult
		);
		expect(compiled.graph.nodes.owned?.priority).toBe(7);
		expect(compiled.graph.incoming.owned).toEqual(['base']);
	});

	it('contains synchronous re-entrant registration as an extension failure', () => {
		const base: GraphExtensionRegistry = createGraphExtensionRegistry({
			declaration: declaration(),
		});
		const registry = base.use({
			extension: {
				contribute: () => {
					base.use({
						extension: { contribute: () => contribution('nested') },
						configuration: undefined,
					});
					return contribution('outer');
				},
			},
			configuration: undefined,
		});

		expect(registry.compile()).toMatchObject({
			ok: false,
			kind: 'extension-failed',
			primaryFailure: { registrationOrder: 1 },
		});
	});

	it('adopts contribution thenables once and reports invalid declarations', async () => {
		let reads = 0;
		const thenable = Object.defineProperty({}, 'then', {
			get() {
				reads += 1;
				return (resolve: (value: unknown) => void) =>
					resolve(contribution('async'));
			},
		});
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: {
				contribute: () =>
					thenable as PromiseLike<GraphExtensionContribution>,
			},
			configuration: undefined,
		});
		expect(reads).toBe(1);
		expectCompiled(await registry.compile());
		expect(reads).toBe(1);

		const invalidContribution = {
			nodes: {
				broken: {
					externalInputs: [],
					effectKeys: [],
					priority: 0,
				},
			},
			executors: {},
		} as unknown as GraphExtensionContribution;
		const invalid = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: {
				contribute: () => invalidContribution,
			},
			configuration: undefined,
		});
		expect(invalid.compile()).toMatchObject({
			ok: false,
			kind: 'graph-invalid',
		});
	});

	it('isolates post-capture registrations in the next immutable generation', async () => {
		const gate = controlled<void>();
		const base = createGraphExtensionRegistry({
			declaration: declaration(),
		});
		let nextGeneration!: GraphExtensionRegistry;
		const registry = base.use({
			extension: {
				contribute: async () => {
					await gate.promise;
					nextGeneration = nextGeneration.use({
						extension: {
							contribute: () => contribution('nested'),
						},
						configuration: undefined,
					});
					return contribution('outer');
				},
			},
			configuration: undefined,
		});
		const captured = registry.compile();
		nextGeneration = registry.use({
			extension: {
				contribute: () => contribution('independent'),
			},
			configuration: undefined,
		});

		gate.resolve(undefined);
		const first = expectCompiled(await captured);
		expect(first.graph.nodes.outer).toBeDefined();
		expect(first.graph.nodes.independent).toBeUndefined();
		expect(first.graph.nodes.nested).toBeUndefined();

		const next = expectCompiled(await nextGeneration.compile());
		expect(next.graph.nodes.outer).toBeDefined();
		expect(next.graph.nodes.independent).toBeDefined();
		expect(next.graph.nodes.nested).toBeDefined();
	});

	it('owns the base declaration and executor table at compile capture', async () => {
		const gate = controlled<GraphExtensionContribution>();
		const base = declaration();
		const extensionThis: unknown[] = [];
		const registry = createGraphExtensionRegistry({
			declaration: base,
		}).use({
			extension: {
				contribute(this: unknown) {
					extensionThis.push(this);
					return gate.promise;
				},
			},
			configuration: undefined,
		});
		const captured = registry.compile();
		(base.nodes.base as unknown as { priority: number }).priority = 99;
		(base.executors as { base: () => unknown }).base = executor('mutated');

		gate.resolve({
			nodes: {
				added: { externalInputs: [], effectKeys: [], priority: 0 },
			},
			edges: [{ from: 'base', to: 'added' }],
			executors: { added: executor('added') },
		});
		const compiled = expectCompiled(await captured);
		const outcome = scheduleGraph({
			graph: compiled.graph,
			inputs: {},
			capabilities: undefined,
			participants: {},
		});

		expect(extensionThis).toEqual([undefined]);
		expect(compiled.graph.nodes.base?.priority).toBe(0);
		expect(outcome).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'base' },
		});
	});

	it('returns its cached graph synchronously after async cells settle', async () => {
		const gate = controlled<GraphExtensionContribution>();
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: { contribute: () => gate.promise },
			configuration: undefined,
		});

		const first = registry.compile();
		expect(first).toBeInstanceOf(Promise);
		gate.resolve(contribution('async'));
		const settled = await first;

		const second = registry.compile();
		expect(second).not.toBeInstanceOf(Promise);
		expect(second).toBe(settled);
	});

	it('appends a wide synchronous generation in canonical order', () => {
		const width = 8_192;
		const markerIndexes = new Set([0, width / 2, width - 1]);
		let registry: GraphExtensionRegistry = createGraphExtensionRegistry({
			declaration: declaration(),
		});
		for (let index = 0; index < width; index += 1) {
			const key = `marker-${index}`;
			const extensionContribution: GraphExtensionContribution =
				markerIndexes.has(index)
					? {
							nodes: {
								[key]: {
									externalInputs: [],
									effectKeys: [],
									priority: 0,
								},
							},
							executors: { [key]: executor(key) },
						}
					: { executors: {} };
			registry = registry.use({
				extension: { contribute: () => extensionContribution },
				configuration: undefined,
			});
		}

		const result = registry.compile();
		expect(result).not.toBeInstanceOf(Promise);
		const compiled = expectCompiled(result as CompileGraphExtensionsResult);
		expect(compiled.graph.nodes['marker-0']?.registrationOrder).toBe(1);
		expect(
			compiled.graph.nodes[`marker-${width / 2}`]?.registrationOrder
		).toBe(width / 2 + 1);
		expect(
			compiled.graph.nodes[`marker-${width - 1}`]?.registrationOrder
		).toBe(width);
	});
});
