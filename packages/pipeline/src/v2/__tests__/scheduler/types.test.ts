import type {
	EffectRegistry,
	GraphOutputs,
	GraphValue,
	NodeContract,
} from '../../graph/types.js';
import type {
	GraphScheduleOutcome,
	ScheduledNodeOutcome,
} from '../../scheduler/types.js';

interface FailureA {
	readonly code: 'a';
}

interface FailureB {
	readonly code: 'b';
}

type Nodes = Readonly<{
	a: NodeContract<never, 'a-output', FailureA>;
	b: NodeContract<never, 'b-output', FailureB>;
}>;

type Projection = Readonly<{ result: 'a' }>;
type Outcome = GraphScheduleOutcome<
	Nodes,
	GraphOutputs<Nodes, Projection>,
	EffectRegistry
>;

const assertDeclaredFailureNarrowing = (outcome: Outcome): void => {
	if (outcome.kind !== 'failed') {
		return;
	}
	const failure = outcome.primaryFailure;
	if (failure.kind === 'declared' && failure.node === 'a') {
		const exact: FailureA = failure.error;
		// @ts-expect-error node a cannot expose node b's declared failure.
		const wrong: FailureB = failure.error;
		void exact;
		void wrong;
	}
	if (failure.kind === 'thrown' && failure.node === 'a') {
		// @ts-expect-error arbitrary JavaScript throws remain unknown.
		const notDeclared: FailureA = failure.error;
		void notDeclared;
	}
};

const assertNodeOutcomeNarrowing = (
	outcome: ScheduledNodeOutcome<Nodes>
): void => {
	if (outcome.kind === 'succeeded' && outcome.node === 'a') {
		const exact: 'a-output' = outcome.output;
		// @ts-expect-error node a cannot expose node b's output.
		const wrong: 'b-output' = outcome.output;
		void exact;
		void wrong;
	}
	if (
		outcome.kind === 'failed' &&
		outcome.failure.kind === 'declared' &&
		outcome.failure.node === 'b'
	) {
		const exact: FailureB = outcome.failure.error;
		void exact;
	}
};

describe('v2 scheduler public result types', () => {
	it('retain node-specific declared failures and outputs', () => {
		expect(assertDeclaredFailureNarrowing).toEqual(expect.any(Function));
		expect(assertNodeOutcomeNarrowing).toEqual(expect.any(Function));
		expect(null as GraphValue).toBeNull();
	});
});
