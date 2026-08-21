import { compileGraphOrThrow } from '../../graph/index.js';
import type {
	EffectContract,
	GraphDeclaration,
	NodeContract,
} from '../../graph/types.js';
import type {
	EffectJournalFailure,
	EffectParticipants,
} from '../../effects/types.js';
import {
	scheduleGraph,
	type ScheduleGraphOptions,
} from '../../scheduler/index.js';

interface EmailFailure {
	readonly code: 'email';
}

interface WriteFailure {
	readonly code: 'write';
}

type Inputs = Readonly<Record<never, never>>;
type Nodes = Readonly<{
	emit: NodeContract<never, 'done', 'node-failure', 'email' | 'write'>;
}>;
type Edges = readonly [];
type Effects = Readonly<{
	email: EffectContract<
		Readonly<{ to: string }>,
		Readonly<{ messageId: string }>,
		Readonly<{ accepted: true }>,
		EmailFailure
	>;
	write: EffectContract<string, number, bigint, WriteFailure>;
}>;
type Projection = Readonly<{ result: 'emit' }>;
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
		emit: {
			externalInputs: [],
			effectKeys: ['email', 'write'],
			priority: 0,
		},
	},
	edges: [],
	effects: { email: {}, write: {} },
	outputs: { result: 'emit' },
	policy: { maxConcurrency: 1 },
	executors: {
		emit: () => ({
			kind: 'success',
			output: 'done',
			effects: [
				{ participant: 'email', payload: { to: 'owner@example.com' } },
			],
		}),
	},
};

const graph = compileGraphOrThrow({ declaration });

const participants = {
	email: {
		prepare({ payload, signal }) {
			const to: string = payload.to;
			const exactSignal: AbortSignal = signal;
			void to;
			void exactSignal;
			return {
				kind: 'success' as const,
				value: { messageId: 'message' },
			};
		},
		commit({ prepared, signal }) {
			const messageId: string = prepared.messageId;
			void messageId;
			void signal;
			return {
				kind: 'success' as const,
				value: { accepted: true as const },
			};
		},
		compensate({ prepared, receipt }) {
			const messageId: string = prepared.messageId;
			const accepted: true | undefined = receipt?.accepted;
			void messageId;
			void accepted;
			return { kind: 'success' as const, value: undefined };
		},
	},
	write: {
		prepare({ payload }) {
			const text: string = payload;
			return { kind: 'success' as const, value: text.length };
		},
		commit({ prepared }) {
			const length: number = prepared;
			return { kind: 'success' as const, value: BigInt(length) };
		},
		compensate({ prepared, receipt }) {
			const length: number = prepared;
			const committed: bigint | undefined = receipt;
			void length;
			void committed;
			return { kind: 'success' as const, value: undefined };
		},
	},
} satisfies EffectParticipants<Effects>;

const _result = scheduleGraph({
	graph,
	inputs: {},
	capabilities: {},
	participants,
});

type Outcome = Awaited<typeof _result>;

const assertOutcomeCorrelation = (outcome: Outcome): void => {
	if (outcome.kind === 'succeeded') {
		const output: 'done' = outcome.outputs.result;
		void output;
	}
	for (const failure of outcome.effectFailures) {
		if (failure.participant === 'email' && failure.kind === 'declared') {
			const exact: EmailFailure = failure.error;
			// @ts-expect-error email failures cannot expose write failures.
			const wrong: WriteFailure = failure.error;
			void exact;
			void wrong;
		}
		if (failure.participant === 'write' && failure.kind === 'declared') {
			const exact: WriteFailure = failure.error;
			void exact;
		}
	}
	for (const entry of outcome.effectJournal) {
		if (entry.request.participant === 'email') {
			const recipient: string = entry.request.payload.to;
			// @ts-expect-error email payloads are not write strings.
			const wrong: string = entry.request.payload;
			void recipient;
			void wrong;
		}
	}
};

const assertFailureCorrelation = (
	failure: EffectJournalFailure<Effects>
): void => {
	if (failure.kind === 'declared' && failure.participant === 'write') {
		const exact: WriteFailure = failure.error;
		void exact;
	}
	if (failure.kind === 'thrown') {
		// @ts-expect-error arbitrary JavaScript throws remain unknown.
		const notDeclared: EmailFailure = failure.error;
		void notDeclared;
	}
};

type EffectFailureKind = EffectJournalFailure<Effects>['kind'];
const acceptedFailureKinds: Readonly<Record<EffectFailureKind, true>> = {
	declared: true,
	thrown: true,
};
// @ts-expect-error effect failures expose no third public classification.
const invalidFailureKind: EffectFailureKind = 'contract';

// @ts-expect-error every declared effect participant is required.
const missingParticipant: EffectParticipants<Effects> = {
	email: participants.email,
};

const extraParticipant = {
	...participants,
	// @ts-expect-error participant registries remain closed to declared keys.
	other: participants.email,
} satisfies EffectParticipants<Effects>;

const invalidParticipant = {
	...participants,
	email: {
		...participants.email,
		// @ts-expect-error email prepare receives the email payload.
		prepare: ({ payload }: { readonly payload: number }) => ({
			kind: 'success' as const,
			value: { messageId: String(payload) },
		}),
	},
} satisfies EffectParticipants<Effects>;

type EmptyEffects = Readonly<Record<never, never>>;
const emptyParticipants: EffectParticipants<EmptyEffects> = {};
const invalidEmptyParticipants: EffectParticipants<EmptyEffects> = {
	// @ts-expect-error an empty effect registry admits no runtime participant.
	write: participants.write,
};

const extraParticipantsVariable = {
	...participants,
	other: participants.email,
};
const missingParticipantsVariable = { email: participants.email };

type ExtraParticipantOptions = ScheduleGraphOptions<
	Inputs,
	Nodes,
	Edges,
	Effects,
	Projection,
	Capabilities,
	typeof extraParticipantsVariable
>;
const invalidExtraParticipantOptions: ExtraParticipantOptions = {
	graph,
	inputs: {},
	capabilities: {},
	// @ts-expect-error typed option values reject variable extra keys too.
	participants: extraParticipantsVariable,
};

const assertRequiredScheduleParticipants = (): void => {
	// @ts-expect-error scheduleGraph requires the exact participant registry.
	scheduleGraph({ graph, inputs: {}, capabilities: {} });
	scheduleGraph({
		graph,
		inputs: {},
		capabilities: {},
		// @ts-expect-error variable registries cannot add undeclared keys.
		participants: extraParticipantsVariable,
	});
	scheduleGraph({
		graph,
		inputs: {},
		capabilities: {},
		// @ts-expect-error variable registries must retain every declared key.
		participants: missingParticipantsVariable,
	});
};

describe('v2 effect public type correlation', () => {
	it('retains literal participants, phase values and declared failures', () => {
		expect(participants.email.prepare).toEqual(expect.any(Function));
		expect(emptyParticipants).toEqual({});
		expect(assertOutcomeCorrelation).toEqual(expect.any(Function));
		expect(assertFailureCorrelation).toEqual(expect.any(Function));
		expect(acceptedFailureKinds).toEqual(
			expect.objectContaining({ declared: true, thrown: true })
		);
		expect(invalidFailureKind).toBe('contract');
		expect(invalidExtraParticipantOptions).toEqual(expect.any(Object));
		expect(assertRequiredScheduleParticipants).toEqual(
			expect.any(Function)
		);
		expect(missingParticipant).toEqual(expect.any(Object));
		expect(extraParticipant).toEqual(expect.any(Object));
		expect(invalidParticipant).toEqual(expect.any(Object));
		expect(invalidEmptyParticipants).toEqual(expect.any(Object));
	});
});
