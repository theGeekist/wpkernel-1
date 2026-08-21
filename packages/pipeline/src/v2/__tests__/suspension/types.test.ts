import { compileGraphOrThrow } from '../../graph/index.js';
import type {
	EffectContract,
	GraphDeclaration,
	GraphOutputs,
	NodeContract,
} from '../../graph/types.js';
import { scheduleGraph } from '../../scheduler/index.js';
import { abandon, resume } from '../../suspension/index.js';
import type { AbandonmentOutcome, Suspension } from '../../suspension/types.js';

interface CleanupFailure {
	readonly code: 'cleanup';
}

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{
	pause: NodeContract<never, 'paused', 'node-failure', 'write'>;
	complete: NodeContract<never, 'complete', 'complete-failure'>;
}>;
type Edges = readonly [{ readonly from: 'pause'; readonly to: 'complete' }];
type Effects = Readonly<{
	write: EffectContract<'payload', 'prepared', 'receipt', CleanupFailure>;
}>;
type Projection = Readonly<{ result: 'complete' }>;
type Outputs = GraphOutputs<Nodes, Projection>;
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
			priority: 0,
		},
		complete: { externalInputs: [], effectKeys: [], priority: 0 },
	},
	edges: [{ from: 'pause', to: 'complete' }],
	effects: { write: {} },
	outputs: { result: 'complete' },
	policy: { maxConcurrency: 1 },
	executors: {
		pause: () => ({
			kind: 'success',
			output: 'paused',
			effects: [{ participant: 'write', payload: 'payload' }],
			pause: { reason: 'review' },
		}),
		complete: () => ({
			kind: 'success',
			output: 'complete',
			effects: [],
		}),
	},
};

const graph = compileGraphOrThrow({ declaration });
const _scheduled = scheduleGraph({
	graph,
	inputs: {},
	capabilities: {},
	participants: {
		write: {
			prepare: () => ({
				kind: 'success' as const,
				value: 'prepared' as const,
			}),
			commit: () => ({
				kind: 'success' as const,
				value: 'receipt' as const,
			}),
			compensate: () => ({
				kind: 'failure' as const,
				error: { code: 'cleanup' as const },
			}),
		},
	},
});

type Scheduled = Awaited<typeof _scheduled>;

const assertSuspendedNarrowing = (outcome: Scheduled): void => {
	if (outcome.kind !== 'suspended') {
		return;
	}
	const exact: Suspension<Nodes, Outputs, Effects> = outcome.suspension;
	const _resumed = resume({ suspension: exact });
	const assertedResume: 'complete' | undefined =
		(undefined as unknown as Awaited<typeof _resumed>).kind === 'succeeded'
			? (
					undefined as unknown as Awaited<typeof _resumed> & {
						readonly kind: 'succeeded';
					}
				).outputs.result
			: undefined;
	const _abandoned = abandon({ suspension: exact });
	const assertedAbandonment: AbandonmentOutcome<Effects> =
		undefined as unknown as Awaited<typeof _abandoned>;
	void assertedResume;
	void assertedAbandonment;
	void exact;
};

const assertNominalBoundary = (
	suspension: Suspension<Nodes, Outputs, Effects>
) => {
	const spread = { ...suspension };
	// @ts-expect-error spreading loses the private nominal suspension authority.
	const copied: Suspension<Nodes, Outputs, Effects> = spread;
	// @ts-expect-error public diagnostic data cannot fabricate resume authority.
	const literal: Suspension<Nodes, Outputs, Effects> = {
		pause: suspension.pause,
		snapshot: suspension.snapshot,
	};
	void copied;
	void literal;
};

const assertCleanupFailure = (outcome: AbandonmentOutcome<Effects>): void => {
	for (const failure of outcome.cleanupFailures) {
		if (failure.kind === 'declared') {
			const exact: CleanupFailure = failure.error;
			void exact;
		}
		if (failure.kind === 'thrown') {
			// @ts-expect-error arbitrary participant throws remain unknown.
			const notDeclared: CleanupFailure = failure.error;
			void notDeclared;
		}
	}
};

describe('v2 Suspension public types', () => {
	it('retain outputs, effect failures and unconstructable authority', () => {
		expect(assertSuspendedNarrowing).toEqual(expect.any(Function));
		expect(assertNominalBoundary).toEqual(expect.any(Function));
		expect(assertCleanupFailure).toEqual(expect.any(Function));
	});
});
