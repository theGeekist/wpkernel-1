import {
	compileGraph,
	compileGraphOrThrow,
	createGraphCompilationError,
	serializeGraph,
} from '../../graph/index.js';
import type { GraphCompilationError } from '../../graph/index.js';
import { compileGraphWithContributions } from '../../graph/contributions.js';
import { getGraphExecutor } from '../../graph/executors.js';
import type {
	CompileGraphResult,
	Edge,
	EffectContract,
	ErasedGraphDeclaration,
	GraphContribution,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';

type Inputs = Readonly<{ source: string; flag: boolean }>;
type Nodes = {
	readonly parse: NodeContract<
		'source',
		{ readonly parsed: string },
		Error,
		'write'
	>;
	readonly enrich: NodeContract<'flag', { readonly enriched: boolean }>;
	readonly join: NodeContract<never, { readonly result: string }>;
};
type Edges = readonly [Edge<'parse', 'join'>, Edge<'enrich', 'join'>];
type Effects = Readonly<{
	write: EffectContract<string, undefined, undefined, Error>;
}>;
type Outputs = Readonly<{ result: 'join' }>;
type Result = CompileGraphResult<Inputs, Nodes, Edges, Effects, Outputs, never>;

const parseExecutor = () => ({
	kind: 'success' as const,
	output: { parsed: 'x' },
	effects: [],
});

const effectContribution = {
	registrationOrder: 3,
	nodes: {
		emit: {
			externalInputs: [],
			effectKeys: ['write'],
			priority: 0,
		},
	},
	executors: {
		emit: () => ({ kind: 'success', output: null, effects: [] }),
	},
} satisfies GraphContribution;

const declaration = (): GraphDeclaration<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Outputs,
	never
> => ({
	inputKeys: ['source', 'flag'],
	nodes: {
		parse: {
			externalInputs: ['source'],
			effectKeys: ['write'],
			priority: 1,
		},
		enrich: { externalInputs: ['flag'], effectKeys: [], priority: 10 },
		join: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [
		{ from: 'parse', to: 'join' },
		{ from: 'enrich', to: 'join' },
	],
	effects: { write: {} },
	outputs: { result: 'join' },
	anchors: { finalise: 'join' },
	policy: { maxConcurrency: 2 },
	executors: {
		parse: parseExecutor,
		enrich: () => ({
			kind: 'success',
			output: { enriched: true },
			effects: [],
		}),
		join: () => ({
			kind: 'success',
			output: { result: 'x' },
			effects: [],
		}),
	},
});

const compileUnsafe = (options: unknown): Result =>
	(compileGraph as unknown as (candidate: unknown) => Result)(options);

const compiled = () => {
	const result = compileGraph({ declaration: declaration() });
	if (!result.ok) {
		throw new Error(result.diagnostics.map(({ code }) => code).join(', '));
	}
	return result.graph;
};

describe('v2 graph compiler', () => {
	it('compiles immutable keyed fan-in, exact ranks and private executors', () => {
		const graph = compiled();

		expect(graph.inputKeys).toEqual(['flag', 'source']);
		expect(graph.incoming.join).toEqual(['enrich', 'parse']);
		expect(graph.outgoing.parse).toEqual(['join']);
		expect(graph.ranks).toEqual({ enrich: 0, parse: 0, join: 1 });
		expect(graph.ordinals).toEqual({ enrich: 0, parse: 1, join: 2 });
		expect(graph.nodes.parse).not.toHaveProperty('executor');
		expect(getGraphExecutor({ graph, key: 'parse' })).toBe(parseExecutor);
		expect(Object.isFrozen(graph)).toBe(true);
		expect(Object.getPrototypeOf(graph.nodes)).toBeNull();
		expect(Object.getPrototypeOf(graph.incoming)).toBeNull();
		expect(serializeGraph({ graph })).not.toContain(
			'WPKernel compiled graph'
		);
	});

	it('uses raw UTF-16 key order and returns zero for equal serialisation keys', () => {
		const base = declaration();
		const result = compileGraphOrThrow({
			declaration: {
				...base,
				nodes: {
					a: { externalInputs: [], effectKeys: [], priority: 0 },
					aa: { externalInputs: [], effectKeys: [], priority: 0 },
					join: { externalInputs: [], effectKeys: [], priority: 0 },
				},
				edges: [] as unknown as Edges,
				outputs: { result: 'join' },
				anchors: {},
				executors: {
					a: () => ({ kind: 'success', output: null, effects: [] }),
					aa: () => ({ kind: 'success', output: null, effects: [] }),
					join: () => ({
						kind: 'success',
						output: { result: 'x' },
						effects: [],
					}),
				},
			} as unknown as typeof base,
		});
		expect(result.ordinals.a).toBeLessThan(result.ordinals.aa!);
		expect(serializeGraph({ graph: result })).toContain('"kind":"graph"');
	});

	it('canonically serialises shuffled edges, projections and anchors', () => {
		const first = compiled();
		const base = declaration();
		const result = compileGraph({
			declaration: {
				...base,
				inputKeys: ['flag', 'source'],
				edges: [...base.edges].reverse() as unknown as Edges,
				outputs: Object.fromEntries([['result', 'join']]) as Outputs,
				anchors: { z: 'join', a: 'parse' },
			},
		});
		if (!result.ok) {
			throw new Error('Expected shuffled declaration to compile.');
		}
		const serialised = serializeGraph({ graph: result.graph });
		expect(serialised.indexOf('"a"')).toBeLessThan(
			serialised.indexOf('"z"')
		);
		expect(serializeGraph({ graph: first })).toBe(
			serializeGraph({
				graph: {
					...result.graph,
					anchors: first.anchors,
				} as typeof result.graph,
			})
		);
		expect(
			serializeGraph({
				graph: {
					...result.graph,
					outputs: { z: 'join', a: 'parse' } as unknown as Outputs,
				} as typeof result.graph,
			})
		).toContain('"outputs":{"a":"parse","z":"join"}');
	});

	it('keeps static typing exact and rejects illicit dynamic contributions', () => {
		const result = compileUnsafe({
			declaration: declaration(),
			contributions: [],
		});
		expect(result).toMatchObject({ ok: false });
		if (!result.ok) {
			expect(result.diagnostics[0]?.code).toBe('invalid-contribution');
		}
	});

	it('applies internal erased contributions by registration order with executors', () => {
		const base = declaration() as unknown as ErasedGraphDeclaration;
		const later = () => ({
			kind: 'success' as const,
			output: null,
			effects: [],
		});
		const earlier = () => ({
			kind: 'success' as const,
			output: null,
			effects: [],
		});
		const result = compileGraphWithContributions({
			declaration: base,
			contributions: [
				effectContribution,
				{
					registrationOrder: 2,
					nodes: {
						later: {
							externalInputs: [],
							effectKeys: [],
							priority: 0,
						},
					},
					executors: { later },
				},
				{
					registrationOrder: 1,
					nodes: {
						earlier: {
							externalInputs: [],
							effectKeys: [],
							priority: 0,
						},
					},
					executors: { earlier },
				},
			],
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.graph.nodes.earlier?.registrationOrder).toBe(1);
			expect(result.graph.nodes.later?.registrationOrder).toBe(2);
			expect(
				getGraphExecutor({ graph: result.graph, key: 'earlier' })
			).toBe(earlier);
			expect(result.graph.nodes.emit?.effectKeys).toEqual(['write']);
		}
	});

	it('rejects malformed contribution coverage, orders and nesting', () => {
		const base = declaration() as unknown as ErasedGraphDeclaration;
		const candidates: readonly unknown[][] = [
			[null],
			[{ registrationOrder: 0, executors: {} }],
			[
				{ registrationOrder: 1, executors: {} },
				{ registrationOrder: 1, executors: {} },
			],
			[
				{
					registrationOrder: 1,
					nodes: {
						x: { externalInputs: [], effectKeys: [], priority: 0 },
					},
					executors: {},
					contributions: [],
				},
			],
		];
		for (const contributions of candidates) {
			const result = compileGraphWithContributions({
				declaration: base,
				contributions: contributions as never,
			});
			expect(result.ok).toBe(false);
		}
	});

	it('retains independent diagnostics and truthful SCC witnesses', () => {
		const base = declaration();
		const result = compileUnsafe({
			declaration: {
				...base,
				policy: { maxConcurrency: 0 },
				edges: [
					{ from: 'parse', to: 'join' },
					{ from: 'join', to: 'parse' },
					{ from: 'join', to: 'enrich' },
				],
				outputs: { result: 'missing' },
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const codes = result.diagnostics.map(({ code }) => code);
			expect(codes).toEqual(
				expect.arrayContaining([
					'invalid-policy',
					'invalid-output',
					'cycle',
					'blocked-by-cycle',
				])
			);
			expect(
				result.diagnostics.find(({ code }) => code === 'cycle')?.message
			).toContain('join -> parse -> join');
			expect(
				result.diagnostics.find(
					({ code }) => code === 'blocked-by-cycle'
				)?.message
			).toContain('enrich');
		}
	});

	it('uses exact edge pairs for hostile NUL-containing keys', () => {
		const result = compileUnsafe({
			declaration: {
				inputKeys: [],
				nodes: Object.assign(Object.create(null), {
					'a\u0000b': {
						externalInputs: [],
						effectKeys: [],
						priority: 0,
					},
					a: { externalInputs: [], effectKeys: [], priority: 0 },
					c: { externalInputs: [], effectKeys: [], priority: 0 },
					'b\u0000c': {
						externalInputs: [],
						effectKeys: [],
						priority: 0,
					},
				}),
				edges: [
					{ from: 'a\u0000b', to: 'c' },
					{ from: 'a', to: 'b\u0000c' },
				],
				effects: {},
				outputs: { result: 'c' },
				policy: { maxConcurrency: 1 },
				executors: Object.assign(Object.create(null), {
					'a\u0000b': () => null,
					a: () => null,
					c: () => null,
					'b\u0000c': () => null,
				}),
			},
		});
		expect(result.ok).toBe(true);
	});

	it('finds a cycle witness through SCC chords without revisiting nodes', () => {
		const result = compileUnsafe({
			declaration: {
				inputKeys: [],
				nodes: {
					a: { externalInputs: [], effectKeys: [], priority: 0 },
					b: { externalInputs: [], effectKeys: [], priority: 0 },
					c: { externalInputs: [], effectKeys: [], priority: 0 },
				},
				edges: [
					{ from: 'a', to: 'b' },
					{ from: 'b', to: 'b' },
					{ from: 'b', to: 'c' },
					{ from: 'c', to: 'a' },
				],
				effects: {},
				outputs: { result: 'c' },
				policy: { maxConcurrency: 1 },
				executors: {
					a: () => null,
					b: () => null,
					c: () => null,
				},
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.map(({ code }) => code)).toContain(
				'cycle'
			);
		}
	});

	it('contains hostile inspection and preserves earlier diagnostics', () => {
		const policy = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile policy');
				},
			}
		);
		const result = compileUnsafe({
			declaration: { ...declaration(), policy },
			contributions: [],
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics[0]?.code).toBe('invalid-contribution');
			expect(result.diagnostics.map(({ code }) => code)).toContain(
				'invalid-node'
			);
		}
	});

	it('provides a frozen native exception adapter without losing diagnostics', () => {
		try {
			compileGraphOrThrow({
				declaration: {
					...declaration(),
					policy: { maxConcurrency: 0 },
				},
			});
			throw new Error('Expected compilation to fail.');
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
			expect(Object.isFrozen(error)).toBe(true);
			expect(error).toMatchObject({
				name: 'GraphCompilationError',
				diagnostics: [{ code: 'invalid-policy' }],
			});
			expect(
				Object.isFrozen((error as GraphCompilationError).diagnostics)
			).toBe(true);
		}
	});

	it('retains compilation error cause and immutable own metadata', () => {
		const cause = new Error('inspection');
		const error = createGraphCompilationError({
			diagnostics: [
				{ code: 'invalid-node', message: 'Invalid node.', path: [] },
			],
			cause,
		});

		expect(error).toBeInstanceOf(Error);
		expect(Object.getPrototypeOf(error)).toBe(Error.prototype);
		expect(Object.isFrozen(error)).toBe(true);
		expect(error).toMatchObject({
			name: 'GraphCompilationError',
			message: 'Invalid node.',
			cause,
		});
		expect(Object.hasOwn(error, 'name')).toBe(true);
		expect(Object.hasOwn(error, 'diagnostics')).toBe(true);
		expect(Object.isFrozen(error.diagnostics[0])).toBe(true);
		expect(Object.isFrozen(error.diagnostics[0]!.path)).toBe(true);
	});

	it('rejects unknown inputs, effects, references and executor coverage', () => {
		const base = declaration();
		const result = compileUnsafe({
			declaration: {
				...base,
				nodes: {
					...base.nodes,
					parse: {
						externalInputs: ['missing'],
						effectKeys: ['missing'],
						priority: 1,
					},
				},
				anchors: { finalise: 'missing' },
				executors: { ...base.executors, extra: () => null },
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics.map(({ code }) => code)).toEqual(
				expect.arrayContaining([
					'invalid-input',
					'invalid-effect',
					'invalid-anchor',
					'invalid-node',
				])
			);
		}
	});
});
