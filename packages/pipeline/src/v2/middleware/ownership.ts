import { inspectRecord } from '../graph/inspection.js';
import type { EffectRegistry } from '../graph/types.js';
import { GraphSchedulerError } from '../scheduler/errors.js';
import { ownEffectRequests } from '../scheduler/ownership.js';
import type { PendingEffect } from '../scheduler/types.js';

export type OwnedMiddlewareResult<TEffects extends EffectRegistry> =
	| {
			readonly ok: true;
			readonly state: unknown;
			readonly effects: readonly PendingEffect<TEffects>[];
	  }
	| { readonly ok: false; readonly error: GraphSchedulerError };

const contractError = (options: {
	readonly node: string;
	readonly phase: 'before' | 'after' | 'error' | 'cancel';
	readonly message: string;
	readonly cause?: unknown;
}): GraphSchedulerError =>
	new GraphSchedulerError({
		code: 'invalid-middleware',
		message: `Middleware ${options.phase} phase for node "${options.node}" ${options.message}`,
		...(options.cause === undefined ? {} : { cause: options.cause }),
	});

export const ownMiddlewareBeforeResult = <
	TEffects extends EffectRegistry,
>(options: {
	readonly value: unknown;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinalStart: number;
	readonly effectKeys: readonly string[];
}): OwnedMiddlewareResult<TEffects> => {
	let fields: ReadonlyMap<string, unknown>;
	try {
		const inspected = inspectRecord(options.value);
		if (!inspected.ok) {
			return {
				ok: false,
				error: contractError({
					node: options.node,
					phase: 'before',
					message: `returned invalid state: ${inspected.reason}`,
				}),
			};
		}
		fields = new Map(
			inspected.value.map(({ key, value }) => [key, value] as const)
		);
	} catch (cause) {
		return {
			ok: false,
			error: contractError({
				node: options.node,
				phase: 'before',
				message: 'result inspection failed.',
				cause,
			}),
		};
	}
	if (!fields.has('state') || !fields.has('effects')) {
		return {
			ok: false,
			error: contractError({
				node: options.node,
				phase: 'before',
				message: 'must return explicit state and effects.',
			}),
		};
	}
	const effects = ownEffectRequests<TEffects>({
		value: fields.get('effects'),
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
		effectOrdinalStart: options.effectOrdinalStart,
		allowedParticipants: new Set(options.effectKeys),
	});
	return effects.ok
		? {
				ok: true,
				state: fields.get('state'),
				effects: effects.value,
			}
		: { ok: false, error: effects.error };
};

export const ownMiddlewareAfterResult = <
	TEffects extends EffectRegistry,
>(options: {
	readonly value: unknown;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinalStart: number;
	readonly effectKeys: readonly string[];
}): OwnedMiddlewareResult<TEffects> => {
	const effects = ownEffectRequests<TEffects>({
		value: options.value,
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
		effectOrdinalStart: options.effectOrdinalStart,
		allowedParticipants: new Set(options.effectKeys),
	});
	return effects.ok
		? { ok: true, state: undefined, effects: effects.value }
		: { ok: false, error: effects.error };
};

export const ownMiddlewareCleanupResult = (options: {
	readonly value: unknown;
	readonly node: string;
	readonly phase: 'error' | 'cancel';
}): GraphSchedulerError | undefined =>
	options.value === undefined
		? undefined
		: contractError({
				node: options.node,
				phase: options.phase,
				message: 'must return void.',
			});
