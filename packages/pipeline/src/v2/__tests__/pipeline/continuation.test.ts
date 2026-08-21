import type {
	Edge,
	EffectContract,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';
import {
	abandon,
	createPipeline,
	resume,
	runPipeline,
} from '../../pipeline/index.js';

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{
	pause: NodeContract<never, 'paused', never, 'write'>;
	later: NodeContract<never, 'complete'>;
}>;
type Edges = readonly [Edge<'pause', 'later'>];
type Effects = Readonly<{
	write: EffectContract<string, string, string, string>;
}>;
type Projection = Readonly<{ result: 'later' }>;
type Capabilities = Readonly<Record<never, never>>;

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
		pause: {
			externalInputs: [],
			effectKeys: ['write'],
			priority: 1,
		},
		later: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [{ from: 'pause', to: 'later' }],
	effects: { write: {} },
	outputs: { result: 'later' },
	policy: { maxConcurrency: 1 },
	executors: {
		pause: () => ({
			kind: 'success',
			output: 'paused',
			effects: [{ participant: 'write', payload: 'payload' }],
			pause: { reason: 'review' },
		}),
		later: () => ({ kind: 'success', output: 'complete', effects: [] }),
	},
};

const phaseSuccess = <TValue>(value: TValue) => ({
	kind: 'success' as const,
	value,
});

const create = (compensate = jest.fn(() => phaseSuccess(undefined))) => ({
	compensate,
	pipeline: createPipeline({
		declaration,
		participants: {
			write: {
				prepare: () => phaseSuccess('prepared'),
				commit: () => phaseSuccess('receipt'),
				compensate,
			},
		},
	}),
});

const suspend = (pipeline: ReturnType<typeof create>['pipeline']) => {
	const outcome = runPipeline({
		pipeline,
		inputs: {},
		capabilities: {},
	});
	const settled = outcome as Awaited<typeof outcome>;
	if (outcome instanceof Promise || settled.kind !== 'suspended') {
		throw new Error('Expected a synchronous suspension.');
	}
	return settled;
};

describe('v2 Pipeline suspension operations', () => {
	it('resumes through the hand-curated Pipeline surface', () => {
		const { pipeline } = create();
		const suspended = suspend(pipeline);

		expect(suspended).not.toHaveProperty('pendingEffects');
		expect(suspended).not.toHaveProperty('pendingPauses');
		expect(suspended.primaryPause).toEqual({
			node: 'pause',
			nodeOrdinal: 0,
			request: { reason: 'review' },
		});

		const completed = resume({ suspension: suspended.suspension });

		expect(completed).not.toBeInstanceOf(Promise);
		expect(completed).toMatchObject({
			kind: 'succeeded',
			outputs: { result: 'complete' },
			effectJournal: [{ commit: 'succeeded' }],
		});
		if (completed instanceof Promise) {
			throw new Error('Expected synchronous resume.');
		}
		expect(completed).not.toHaveProperty('pendingEffects');
		expect(completed).not.toHaveProperty('pendingPauses');
	});

	it('abandons through the hand-curated Pipeline surface', () => {
		const { compensate, pipeline } = create();
		const suspended = suspend(pipeline);

		const abandoned = abandon({ suspension: suspended.suspension });

		expect(abandoned).not.toBeInstanceOf(Promise);
		expect(abandoned).toMatchObject({
			kind: 'abandoned',
			effectJournal: [{ compensation: 'succeeded' }],
		});
		expect(compensate).toHaveBeenCalledTimes(1);
	});
});
