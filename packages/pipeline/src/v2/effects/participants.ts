import { inspectRecord } from '../graph/inspection.js';
import { getGraphEffectKeys } from '../graph/executors.js';
import type { ErasedGraph } from '../graph/types.js';
import { GraphSchedulerError } from '../scheduler/errors.js';
import type {
	CompiledEffectParticipants,
	ErasedEffectParticipant,
} from './types.js';

const phaseNames = ['prepare', 'commit', 'compensate'] as const;

const inspectParticipant = (options: {
	readonly key: string;
	readonly value: unknown;
}): ErasedEffectParticipant => {
	let fields: ReadonlyMap<string, unknown>;
	try {
		const inspected = inspectRecord(options.value);
		if (!inspected.ok) {
			throw new Error(inspected.reason);
		}
		fields = new Map(
			inspected.value.map(({ key, value }) => [key, value] as const)
		);
	} catch (cause) {
		throw new GraphSchedulerError({
			code: 'invalid-participant',
			message: `Effect participant "${options.key}" must be an inspectable plain record.`,
			cause,
		});
	}
	for (const phase of phaseNames) {
		if (typeof fields.get(phase) !== 'function') {
			throw new GraphSchedulerError({
				code: 'invalid-participant',
				message: `Effect participant "${options.key}" requires a callable ${phase} phase.`,
			});
		}
	}
	return Object.freeze(
		Object.fromEntries(
			phaseNames.map((phase) => [phase, fields.get(phase)])
		)
	) as unknown as ErasedEffectParticipant;
};

/**
 * Captures and validates one run's process-local participant authority.
 *
 * @param options              - Participant compilation options.
 * @param options.graph        - Compiled graph requiring participants.
 * @param options.participants - Untrusted runtime participant registry.
 */
export const compileEffectParticipants = (options: {
	readonly graph: ErasedGraph;
	readonly participants: unknown;
}): CompiledEffectParticipants => {
	let entries: readonly { readonly key: string; readonly value: unknown }[];
	try {
		const inspected = inspectRecord(options.participants);
		if (!inspected.ok) {
			throw new Error(inspected.reason);
		}
		entries = inspected.value;
	} catch (cause) {
		throw new GraphSchedulerError({
			code: 'invalid-participant',
			message: 'Effect participants must be an inspectable plain record.',
			cause,
		});
	}
	const declaredKeys = getGraphEffectKeys({ graph: options.graph });
	if (!declaredKeys) {
		throw new GraphSchedulerError({
			code: 'invalid-graph',
			message: 'Compiled graph effect authority is unavailable.',
		});
	}
	const declared = new Set(declaredKeys);
	for (const { key } of entries) {
		if (!declared.has(key)) {
			throw new GraphSchedulerError({
				code: 'invalid-participant',
				message: `Effect participant "${key}" is not declared by the compiled graph.`,
			});
		}
	}
	const participants: Record<string, ErasedEffectParticipant> = Object.create(
		null
	) as Record<string, ErasedEffectParticipant>;
	for (const { key, value } of entries) {
		participants[key] = inspectParticipant({ key, value });
	}
	for (const key of declaredKeys) {
		if (!participants[key]) {
			throw new GraphSchedulerError({
				code: 'invalid-participant',
				message: `Effect participant "${key}" is required by the compiled graph.`,
			});
		}
	}
	return Object.freeze(participants);
};
