import { compileGraph } from '../../graph/index.js';
import { compileGraphWithContributions } from '../../graph/contributions.js';
import type {
	ErasedCompileGraphResult,
	ErasedGraphDeclaration,
} from '../../graph/types.js';

const compileUnknown = (options: unknown): ErasedCompileGraphResult =>
	(
		compileGraph as unknown as (
			candidate: unknown
		) => ErasedCompileGraphResult
	)(options);

const executor = () => ({
	kind: 'success' as const,
	output: null,
	effects: [],
});

const validDeclaration = () => ({
	inputKeys: ['input'],
	nodes: {
		a: {
			externalInputs: ['input'],
			effectKeys: ['effect'],
			priority: 0,
		},
		b: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [{ from: 'a', to: 'b' }],
	effects: { effect: {} },
	outputs: { result: 'b' },
	anchors: { end: 'b' },
	policy: { maxConcurrency: 'unbounded' },
	executors: { a: executor, b: executor },
});

const diagnosticCodes = (result: ErasedCompileGraphResult) =>
	result.ok ? [] : result.diagnostics.map(({ code }) => code);

describe('graph compiler adversarial validation', () => {
	it('rejects malformed top-level options, records and arrays without throwing', () => {
		const hostileRecord = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile record');
				},
			}
		);
		const hostileArray = new Proxy([], {
			ownKeys() {
				throw new Error('hostile array');
			},
		});
		const cases: readonly unknown[] = [
			null,
			hostileRecord,
			{ declaration: hostileRecord },
			{ declaration: { ...validDeclaration(), nodes: 1 } },
			{ declaration: { ...validDeclaration(), edges: hostileArray } },
			{ declaration: { ...validDeclaration(), inputKeys: hostileArray } },
			{ declaration: { ...validDeclaration(), outputs: hostileRecord } },
			{ declaration: { ...validDeclaration(), effects: hostileRecord } },
		];

		for (const candidate of cases) {
			expect(compileUnknown(candidate).ok).toBe(false);
		}
	});

	it('reports invalid and duplicate input and effect key declarations', () => {
		const base = validDeclaration();
		const result = compileUnknown({
			declaration: {
				...base,
				inputKeys: ['input', 'input', 1],
				nodes: {
					...base.nodes,
					a: {
						externalInputs: ['input', 'input', 1],
						effectKeys: ['effect', 'effect', 1],
						priority: 0,
					},
				},
			},
		});

		expect(diagnosticCodes(result)).toEqual(
			expect.arrayContaining(['invalid-input', 'invalid-effect'])
		);
	});

	it('reports every malformed node shape and hostile contract inspection', () => {
		const hostileContract = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile contract');
				},
			}
		);
		const base = validDeclaration();
		const malformed = [
			1,
			{ externalInputs: 'input', effectKeys: [], priority: 0 },
			{ externalInputs: [], priority: 0 },
			{ externalInputs: [], effectKeys: [], priority: Number.NaN },
			hostileContract,
		];
		for (const contract of malformed) {
			const result = compileUnknown({
				declaration: {
					...base,
					nodes: { broken: contract },
					edges: [],
					outputs: {},
					anchors: {},
					executors: { broken: executor },
				},
			});
			expect(result.ok).toBe(false);
		}
	});

	it('validates malformed, missing, duplicate and hostile edges independently', () => {
		const hostileEdge = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile edge');
				},
			}
		);
		const base = validDeclaration();
		const result = compileUnknown({
			declaration: {
				...base,
				edges: [
					null,
					{ from: 1, to: 'b' },
					hostileEdge,
					{ from: 'missing', to: 'b' },
					{ from: 'a', to: 'b' },
					{ from: 'a', to: 'b' },
				],
			},
		});

		expect(diagnosticCodes(result)).toEqual(
			expect.arrayContaining(['invalid-node', 'missing-node'])
		);
	});

	it('validates output, anchor, executor and policy alternatives', () => {
		const base = validDeclaration();
		const invalid = compileUnknown({
			declaration: {
				...base,
				outputs: { wrongType: 1, missing: 'missing' },
				anchors: { wrongType: 1, missing: 'missing' },
				policy: null,
				executors: { a: 1, extra: executor },
			},
		});
		expect(diagnosticCodes(invalid)).toEqual(
			expect.arrayContaining([
				'invalid-output',
				'invalid-anchor',
				'invalid-node',
			])
		);

		const positive = compileUnknown({
			declaration: { ...base, policy: { maxConcurrency: 1 } },
		});
		expect(positive.ok).toBe(true);
	});

	it('validates contribution records, arrays, duplicates and exact executors', () => {
		const base = validDeclaration() as unknown as ErasedGraphDeclaration;
		const hostile = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error('hostile contribution');
				},
			}
		);
		const result = compileGraphWithContributions({
			declaration: base,
			contributions: [
				hostile as never,
				{ registrationOrder: 1, executors: {} },
				{ registrationOrder: 1, executors: {} },
				{
					registrationOrder: 2,
					nodes: {
						x: { externalInputs: [], effectKeys: [], priority: 0 },
					},
					executors: { wrong: 1 },
				},
			],
		});
		expect(diagnosticCodes(result)).toContain('invalid-contribution');
	});

	it('applies contribution edges, outputs and anchors and rejects duplicate nodes', () => {
		const base = validDeclaration() as unknown as ErasedGraphDeclaration;
		const result = compileGraphWithContributions({
			declaration: base,
			contributions: [
				{
					registrationOrder: 1,
					nodes: {
						c: { externalInputs: [], effectKeys: [], priority: 0 },
					},
					edges: [{ from: 'b', to: 'c' }],
					outputs: { result: 'c' },
					anchors: { end: 'c' },
					executors: { c: executor },
				},
			],
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.graph.outputs.result).toBe('c');
			expect(result.graph.anchors.end).toBe('c');
		}

		const duplicate = compileGraphWithContributions({
			declaration: base,
			contributions: [
				{
					registrationOrder: 1,
					nodes: {
						a: { externalInputs: [], effectKeys: [], priority: 0 },
					},
					executors: { a: executor },
				},
			],
		});
		expect(diagnosticCodes(duplicate)).toContain('duplicate-node');
	});

	it('contains hostile contribution-array inspection', () => {
		const hostile = new Proxy([], {
			ownKeys() {
				throw new Error('hostile contributions');
			},
		});
		const dynamicCompile = compileGraphWithContributions as unknown as (
			options: unknown
		) => ErasedCompileGraphResult;
		const result = dynamicCompile({
			declaration: validDeclaration(),
			contributions: hostile,
		});
		expect(diagnosticCodes(result)).toContain('invalid-contribution');
	});
});
