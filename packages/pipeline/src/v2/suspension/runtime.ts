import { projectRunDiagnostics } from '../diagnostics/index.js';
import type { RunDiagnostics } from '../diagnostics/types.js';
import {
	compensateEffectJournal,
	projectEffectJournal,
	projectPreparedEffects,
} from '../effects/index.js';
import { settleGraphEffects } from '../effects/outcome.js';
import type {
	EffectRegistry,
	GraphValue,
	NodeRegistry,
} from '../graph/types.js';
import { driveScheduler, listenForAbort } from '../scheduler/engine.js';
import type {
	ErasedRunOutcome,
	ErasedScheduleOutcome,
	SchedulerState,
} from '../scheduler/state.js';
import type { PendingPause, RunOutcome } from '../scheduler/types.js';
import {
	captureSuspensionAuthority,
	restoreSuspendedState,
} from './authority.js';
import { createSuspensionError } from './errors.js';
import type {
	AbandonmentOutcome,
	AbandonOptions,
	AbandonResult,
	ResumeOptions,
	ResumeResult,
	Suspension,
} from './types.js';

type StoredSuspension =
	| { readonly kind: 'available'; readonly authority: unknown }
	| {
			readonly kind: 'consumed';
			readonly operation: 'resume' | 'abandon';
	  };

const suspensionRecords = new WeakMap<object, StoredSuspension>();

const createSuspension = <TEffects extends EffectRegistry>(options: {
	readonly pause: PendingPause;
	readonly snapshot: RunDiagnostics;
	readonly authority: ReturnType<typeof captureSuspensionAuthority<TEffects>>;
}): Suspension<never, never, TEffects> => {
	const projection = Object.freeze(
		Object.assign(Object.create(null) as Record<PropertyKey, unknown>, {
			pause: options.pause,
			snapshot: options.snapshot,
		})
	);
	suspensionRecords.set(projection, {
		kind: 'available',
		authority: options.authority,
	});
	return projection as unknown as Suspension<never, never, TEffects>;
};

const consumeSuspension = <TEffects extends EffectRegistry>(options: {
	readonly value: unknown;
	readonly operation: 'resume' | 'abandon';
}): ReturnType<typeof captureSuspensionAuthority<TEffects>> => {
	if (
		(typeof options.value !== 'object' &&
			typeof options.value !== 'function') ||
		options.value === null
	) {
		throw createSuspensionError({
			code: 'invalid-suspension',
			message: 'Suspension is not a live process-local authority.',
		});
	}
	const stored = suspensionRecords.get(options.value);
	if (!stored) {
		throw createSuspensionError({
			code: 'invalid-suspension',
			message: 'Suspension is not a live process-local authority.',
		});
	}
	if (stored.kind === 'consumed') {
		throw createSuspensionError({
			code: 'already-consumed',
			message: `Suspension has already been consumed by ${stored.operation}.`,
		});
	}
	const authority = stored.authority;
	suspensionRecords.set(options.value, {
		kind: 'consumed',
		operation: options.operation,
	});
	return authority as ReturnType<typeof captureSuspensionAuthority<TEffects>>;
};

const withFinalDiagnostics = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	outcome: ErasedRunOutcome<TEffects>
): ErasedRunOutcome<TEffects> =>
	Object.freeze({
		...outcome,
		observerFailures: state.observers.failures(),
		diagnostics: projectRunDiagnostics(state),
	});

const finishTerminal = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>,
	outcome: ErasedRunOutcome<TEffects>
): ErasedRunOutcome<TEffects> | Promise<ErasedRunOutcome<TEffects>> => {
	const delivery = state.observers.publishTerminal(outcome.kind);
	return delivery
		? delivery.then(() => withFinalDiagnostics(state, outcome))
		: withFinalDiagnostics(state, outcome);
};

const suspendedOutcome = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly scheduled: Extract<
		ErasedScheduleOutcome<TEffects>,
		{ readonly kind: 'pause-requested' }
	>;
	readonly authority: ReturnType<typeof captureSuspensionAuthority<TEffects>>;
}): ErasedRunOutcome<TEffects> => {
	const diagnostics = projectRunDiagnostics(options.state);
	const suspension = createSuspension({
		pause: options.scheduled.primaryPause,
		snapshot: diagnostics,
		authority: options.authority,
	});
	return Object.freeze({
		kind: 'suspended',
		primaryPause: options.scheduled.primaryPause,
		suspension,
		nodes: options.scheduled.nodes,
		pendingEffects: projectPreparedEffects(options.state.journal),
		pendingPauses: options.scheduled.pendingPauses,
		observerFailures: options.state.observers.failures(),
		effectJournal: projectEffectJournal(options.state.journal),
		effectFailures: Object.freeze([...options.state.journal.failures]),
		diagnostics,
	}) as ErasedRunOutcome<TEffects>;
};

const finishSuspension = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly scheduled: Extract<
		ErasedScheduleOutcome<TEffects>,
		{ readonly kind: 'pause-requested' }
	>;
}): ErasedRunOutcome<TEffects> | Promise<ErasedRunOutcome<TEffects>> => {
	const authority = captureSuspensionAuthority(options.state);
	const delivery = options.state.observers.publishTerminal('suspended');
	const project = () => suspendedOutcome({ ...options, authority });
	return delivery ? delivery.then(project) : project();
};

const settleScheduled = <TEffects extends EffectRegistry>(options: {
	readonly state: SchedulerState<TEffects>;
	readonly scheduled: ErasedScheduleOutcome<TEffects>;
}): ErasedRunOutcome<TEffects> | Promise<ErasedRunOutcome<TEffects>> => {
	if (options.scheduled.kind === 'pause-requested') {
		return finishSuspension({
			state: options.state,
			scheduled: options.scheduled,
		});
	}
	const settled = settleGraphEffects({
		runtime: options.state.journal,
		graph: options.scheduled,
		signal: options.state.signal,
	});
	return settled instanceof Promise
		? settled.then((outcome) => finishTerminal(options.state, outcome))
		: finishTerminal(options.state, settled);
};

/**
 * Executes one fresh or resumed scheduler segment.
 *
 * @internal
 * @param state - Fresh or restored explicit scheduler state.
 */
export const executeSchedulerState = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): ErasedRunOutcome<TEffects> | Promise<ErasedRunOutcome<TEffects>> => {
	listenForAbort(state);
	const immediate = driveScheduler(state);
	return immediate
		? settleScheduled({ state, scheduled: immediate })
		: state.completion!.promise.then((scheduled) =>
				settleScheduled({ state, scheduled })
			);
};

/**
 * Consumes and continues one live process-local suspension exactly once.
 *
 * @param options - Live suspension and optional replacement signal.
 */
export const resume = <
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
>(
	options: ResumeOptions<TNodes, TOutputs, TEffects>
): ResumeResult<TNodes, TOutputs, TEffects> => {
	const authority = consumeSuspension<TEffects>({
		value: options.suspension,
		operation: 'resume',
	});
	const state = restoreSuspendedState({
		authority,
		signal: options.signal ?? authority.configuration.signal,
	});
	return executeSchedulerState(state) as ResumeResult<
		TNodes,
		TOutputs,
		TEffects
	>;
};

const abandonmentOutcome = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): AbandonmentOutcome<TEffects> =>
	Object.freeze({
		kind: 'abandoned',
		cleanupFailures: Object.freeze(
			state.journal.failures.filter(
				(failure) => failure.phase === 'compensate'
			)
		),
		effectJournal: projectEffectJournal(state.journal),
		observerFailures: state.observers.failures(),
		diagnostics: projectRunDiagnostics(state),
	});

const finishAbandonment = <TEffects extends EffectRegistry>(
	state: SchedulerState<TEffects>
): AbandonmentOutcome<TEffects> | Promise<AbandonmentOutcome<TEffects>> => {
	const delivery = state.observers.publishTerminal('abandoned');
	return delivery
		? delivery.then(() => abandonmentOutcome(state))
		: abandonmentOutcome(state);
};

/**
 * Consumes one live suspension and compensates its journal exactly once.
 *
 * @param options - Live suspension to abandon.
 */
export const abandon = <
	TNodes extends NodeRegistry,
	TOutputs extends Readonly<Record<string, GraphValue>>,
	TEffects extends EffectRegistry,
>(
	options: AbandonOptions<TNodes, TOutputs, TEffects>
): AbandonResult<TEffects> => {
	const authority = consumeSuspension<TEffects>({
		value: options.suspension,
		operation: 'abandon',
	});
	const signal = new AbortController().signal;
	const state = restoreSuspendedState({ authority, signal });
	const settled = compensateEffectJournal({
		runtime: state.journal,
		signal,
		trigger: 'abandon',
	});
	return settled instanceof Promise
		? settled.then(() => finishAbandonment(state))
		: finishAbandonment(state);
};

export type ErasedSuspension<TEffects extends EffectRegistry> = Suspension<
	NodeRegistry,
	Readonly<Record<string, GraphValue>>,
	TEffects
>;

export type ErasedOutcome<TEffects extends EffectRegistry> = RunOutcome<
	NodeRegistry,
	Readonly<Record<string, GraphValue>>,
	TEffects
>;
