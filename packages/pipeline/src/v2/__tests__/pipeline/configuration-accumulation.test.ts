import type {
	EffectContract,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';
import {
	createPipeline,
	runPipeline,
	type Pipeline,
} from '../../pipeline/index.js';

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{ base: NodeContract<never, 'base'> }>;
type Edges = readonly [];
type Effects = Readonly<{
	write: EffectContract<string, unknown, unknown, unknown>;
}>;
type Projection = Readonly<{ result: 'base' }>;
type Capabilities = Readonly<Record<never, never>>;

const participant = {
	prepare: () => ({ kind: 'success' as const, value: undefined }),
	commit: () => ({ kind: 'success' as const, value: undefined }),
	compensate: () => ({ kind: 'success' as const, value: undefined }),
};

describe('v2 Pipeline configuration issue accumulation', () => {
	it('retains all extension, graph and graph-dependent role issues in order', () => {
		const execute = jest.fn(() => ({
			kind: 'success' as const,
			output: 'base' as const,
			effects: [],
		}));
		const declaration: GraphDeclaration<
			Inputs,
			Nodes,
			Edges,
			Effects,
			Projection,
			Capabilities
		> = {
			inputKeys: [],
			nodes: {
				base: { externalInputs: [], effectKeys: [], priority: 0 },
			},
			edges: [],
			effects: { write: {} },
			outputs: { result: 'base' },
			policy: { maxConcurrency: 1 },
			executors: { base: execute },
		};
		const extensionError = new Error('extension');
		const pipeline = createPipeline({
			declaration,
			extensions: [
				{
					extension: {
						contribute: () => {
							throw extensionError;
						},
					},
					configuration: null,
				},
				{
					extension: {
						contribute: () => ({
							nodes: {
								broken: {
									externalInputs: [],
									effectKeys: [],
									priority: 0,
								},
							},
							executors: {},
						}),
					},
					configuration: null,
				},
			] as never,
			middleware: [{ node: 'missing-z' }, { node: 'missing-a' }] as never,
			observers: [42, 43] as never,
			participants: { extra: participant } as never,
		}) as unknown as Pipeline<
			Inputs,
			Nodes,
			Edges,
			Effects,
			Projection,
			Capabilities
		>;

		const result = runPipeline({ pipeline, inputs: {}, capabilities: {} });

		expect(result).toMatchObject({
			kind: 'configuration-failed',
			primaryFailure: {
				kind: 'extension',
				failure: { registrationOrder: 1, error: extensionError },
			},
			extensionFailures: [
				{ registrationOrder: 1, error: extensionError },
			],
			graphDiagnostics: [
				{ code: 'invalid-contribution' },
				{ code: 'invalid-node' },
			],
			roleFailures: [
				{ kind: 'role', role: 'observer', index: 0 },
				{ kind: 'role', role: 'observer', index: 1 },
				{ kind: 'role', role: 'middleware', index: 0 },
				{ kind: 'role', role: 'middleware', index: 1 },
				{ kind: 'role', role: 'participant', key: 'extra' },
				{ kind: 'role', role: 'participant', key: 'write' },
			],
		});
		if (!('kind' in result) || result.kind !== 'configuration-failed') {
			throw new Error('Expected synchronous configuration failure.');
		}
		expect(result.failures.map(({ kind }) => kind)).toEqual([
			'extension',
			'graph',
			'graph',
			'role',
			'role',
			'role',
			'role',
			'role',
			'role',
		]);
		expect(execute).not.toHaveBeenCalled();
	});
});
