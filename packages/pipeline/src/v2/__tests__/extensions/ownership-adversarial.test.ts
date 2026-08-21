import { createGraphExtensionRegistry } from '../../extensions/index.js';
import type {
	CompileGraphExtensionsResult,
	GraphExtensionContribution,
} from '../../extensions/types.js';
import type { ErasedGraphDeclaration } from '../../graph/types.js';

const executor = () => ({
	kind: 'success' as const,
	output: 'base',
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
		policy: { maxConcurrency: 1 },
		executors: { base: executor },
	}) as unknown as ErasedGraphDeclaration;

const expectInvalid = (result: CompileGraphExtensionsResult): void => {
	expect(result).toMatchObject({ ok: false, kind: 'graph-invalid' });
};

describe('v2 graph extension ownership boundaries', () => {
	it('diagnoses a non-record base declaration after owning it', () => {
		const result = createGraphExtensionRegistry({
			declaration: 42 as never,
		}).compile();

		expect(result).not.toBeInstanceOf(Promise);
		expectInvalid(result as CompileGraphExtensionsResult);
	});

	it.each([
		['non-record contribution', 42],
		['nested contributions', { contributions: [], executors: {} }],
	])('diagnoses a %s after owning it', (_label, contribution) => {
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: {
				contribute: () =>
					contribution as unknown as GraphExtensionContribution,
			},
			configuration: undefined,
		});

		const result = registry.compile();
		expect(result).not.toBeInstanceOf(Promise);
		expectInvalid(result as CompileGraphExtensionsResult);
	});

	it('contains an unownable optional graph field without granting authority', () => {
		const extensionContribution = {
			nodes: () => undefined,
			executors: {},
		} as unknown as GraphExtensionContribution;
		const registry = createGraphExtensionRegistry({
			declaration: declaration(),
		}).use({
			extension: { contribute: () => extensionContribution },
			configuration: undefined,
		});

		const result = registry.compile();
		expect(result).not.toBeInstanceOf(Promise);
		const compiled = result as CompileGraphExtensionsResult;
		if (!compiled.ok) {
			throw new Error(`Expected compilation, received ${compiled.kind}.`);
		}
		expect(Object.keys(compiled.graph.nodes)).toEqual(['base']);
	});
});
