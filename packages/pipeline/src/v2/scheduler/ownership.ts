import { inspectDenseArray, inspectRecord } from '../graph/inspection.js';
import type { EffectRegistry, GraphValue } from '../graph/types.js';
import { copyGraphValue } from '../graph/values.js';
import { createGraphSchedulerError } from './errors.js';
import type { GraphSchedulerError } from './errors.js';
import type { PendingEffect, PendingPause } from './types.js';

export type OwnedNodeResult<TEffects extends EffectRegistry> =
	| {
			readonly kind: 'success';
			readonly output: GraphValue;
			readonly effects: readonly PendingEffect<TEffects>[];
			readonly pause?: PendingPause;
	  }
	| { readonly kind: 'failure'; readonly error: unknown }
	| { readonly kind: 'cancelled'; readonly reason?: unknown }
	| { readonly kind: 'contract'; readonly error: GraphSchedulerError };

const schedulerError = (
	message: string,
	cause?: unknown
): GraphSchedulerError =>
	createGraphSchedulerError({
		code: 'invalid-node-result',
		message,
		...(cause === undefined ? {} : { cause }),
	});

const inspectedFields = (
	value: unknown,
	label: string
):
	| { readonly ok: true; readonly fields: ReadonlyMap<string, unknown> }
	| { readonly ok: false; readonly error: GraphSchedulerError } => {
	try {
		const inspected = inspectRecord(value);
		if (!inspected.ok) {
			return {
				ok: false,
				error: schedulerError(`${label}: ${inspected.reason}`),
			};
		}
		return {
			ok: true,
			fields: new Map(
				inspected.value.map(({ key, value: field }) => [key, field])
			),
		};
	} catch (error) {
		return {
			ok: false,
			error: schedulerError(`${label}: inspection failed.`, error),
		};
	}
};

const copyOutput = (
	value: unknown
):
	| { readonly ok: true; readonly value: GraphValue }
	| { readonly ok: false; readonly error: GraphSchedulerError } => {
	const copied = copyGraphValue({ value });
	return copied.ok
		? copied
		: {
				ok: false,
				error: schedulerError(`Invalid node output: ${copied.reason}`),
			};
};

const ownEffect = <TEffects extends EffectRegistry>(options: {
	readonly value: unknown;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinal: number;
	readonly allowedParticipants: ReadonlySet<string>;
}):
	| { readonly ok: true; readonly value: PendingEffect<TEffects> }
	| { readonly ok: false; readonly error: GraphSchedulerError } => {
	const inspected = inspectedFields(
		options.value,
		`Invalid effect request ${options.effectOrdinal} from node "${options.node}"`
	);
	if (!inspected.ok) {
		return inspected;
	}
	const participant = inspected.fields.get('participant');
	if (
		typeof participant !== 'string' ||
		!options.allowedParticipants.has(participant) ||
		!inspected.fields.has('payload')
	) {
		return {
			ok: false,
			error: schedulerError(
				`Node "${options.node}" returned an undeclared or incomplete effect request.`
			),
		};
	}
	const payload = copyGraphValue({ value: inspected.fields.get('payload') });
	if (!payload.ok) {
		return {
			ok: false,
			error: schedulerError(
				`Invalid effect payload from node "${options.node}": ${payload.reason}`
			),
		};
	}
	return {
		ok: true,
		value: Object.freeze({
			node: options.node,
			nodeOrdinal: options.nodeOrdinal,
			effectOrdinal: options.effectOrdinal,
			request: Object.freeze({ participant, payload: payload.value }),
		}) as PendingEffect<TEffects>,
	};
};

export const ownEffectRequests = <TEffects extends EffectRegistry>(options: {
	readonly value: unknown;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectOrdinalStart: number;
	readonly allowedParticipants: ReadonlySet<string>;
}):
	| { readonly ok: true; readonly value: readonly PendingEffect<TEffects>[] }
	| { readonly ok: false; readonly error: GraphSchedulerError } => {
	let values: readonly unknown[];
	try {
		const inspected = inspectDenseArray(options.value);
		if (!inspected.ok) {
			return {
				ok: false,
				error: schedulerError(
					`Invalid node effects: ${inspected.reason}`
				),
			};
		}
		values = inspected.value;
	} catch (error) {
		return {
			ok: false,
			error: schedulerError('Node effect inspection failed.', error),
		};
	}
	const effects: PendingEffect<TEffects>[] = [];
	for (const [index, value] of values.entries()) {
		const effectOrdinal = options.effectOrdinalStart + index;
		const effect = ownEffect<TEffects>({
			value,
			node: options.node,
			nodeOrdinal: options.nodeOrdinal,
			effectOrdinal,
			allowedParticipants: options.allowedParticipants,
		});
		if (!effect.ok) {
			return effect;
		}
		effects.push(effect.value);
	}
	return { ok: true, value: Object.freeze(effects) };
};

const ownPause = (options: {
	readonly value: unknown;
	readonly node: string;
	readonly nodeOrdinal: number;
}):
	| { readonly ok: true; readonly value: PendingPause }
	| { readonly ok: false; readonly error: GraphSchedulerError } => {
	const inspected = inspectedFields(
		options.value,
		`Invalid pause request from node "${options.node}"`
	);
	if (!inspected.ok) {
		return inspected;
	}
	const reason = inspected.fields.get('reason');
	if (inspected.fields.has('reason') && typeof reason !== 'string') {
		return {
			ok: false,
			error: schedulerError(
				`Pause reason from node "${options.node}" must be a string.`
			),
		};
	}
	return {
		ok: true,
		value: Object.freeze({
			node: options.node,
			nodeOrdinal: options.nodeOrdinal,
			request: Object.freeze(
				inspected.fields.has('reason') ? { reason } : {}
			),
		}) as PendingPause,
	};
};

const ownSuccessResult = <TEffects extends EffectRegistry>(options: {
	readonly fields: ReadonlyMap<string, unknown>;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectKeys: readonly string[];
	readonly effectOrdinalStart: number;
}): OwnedNodeResult<TEffects> => {
	if (!options.fields.has('output') || !options.fields.has('effects')) {
		return {
			kind: 'contract',
			error: schedulerError(
				`Node "${options.node}" returned an incomplete result variant.`
			),
		};
	}
	const output = copyOutput(options.fields.get('output'));
	if (!output.ok) {
		return { kind: 'contract', error: output.error };
	}
	const effects = ownEffectRequests<TEffects>({
		value: options.fields.get('effects'),
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
		effectOrdinalStart: options.effectOrdinalStart,
		allowedParticipants: new Set(options.effectKeys),
	});
	if (!effects.ok) {
		return { kind: 'contract', error: effects.error };
	}
	if (!options.fields.has('pause')) {
		return {
			kind: 'success',
			output: output.value,
			effects: effects.value,
		};
	}
	const pause = ownPause({
		value: options.fields.get('pause'),
		node: options.node,
		nodeOrdinal: options.nodeOrdinal,
	});
	return pause.ok
		? {
				kind: 'success',
				output: output.value,
				effects: effects.value,
				pause: pause.value,
			}
		: { kind: 'contract', error: pause.error };
};

export const ownNodeResult = <TEffects extends EffectRegistry>(options: {
	readonly value: unknown;
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly effectKeys: readonly string[];
	readonly effectOrdinalStart: number;
}): OwnedNodeResult<TEffects> => {
	const inspected = inspectedFields(
		options.value,
		`Invalid result from node "${options.node}"`
	);
	if (!inspected.ok) {
		return { kind: 'contract', error: inspected.error };
	}
	const kind = inspected.fields.get('kind');
	if (kind === 'failure' && inspected.fields.has('error')) {
		return { kind, error: inspected.fields.get('error') };
	}
	if (kind === 'cancelled') {
		return inspected.fields.has('reason')
			? { kind, reason: inspected.fields.get('reason') }
			: { kind };
	}
	if (kind === 'success') {
		return ownSuccessResult({ ...options, fields: inspected.fields });
	}
	return {
		kind: 'contract',
		error: schedulerError(
			`Node "${options.node}" returned an incomplete result variant.`
		),
	};
};

export const ownGraphInputs = (options: {
	readonly value: unknown;
	readonly inputKeys: readonly string[];
}): Readonly<Record<string, GraphValue>> => {
	const copied = copyGraphValue({ value: options.value });
	if (
		!copied.ok ||
		!copied.value ||
		typeof copied.value !== 'object' ||
		Array.isArray(copied.value)
	) {
		throw createGraphSchedulerError({
			code: 'invalid-input',
			message: copied.ok
				? 'Graph inputs must be a plain record.'
				: `Invalid graph inputs: ${copied.reason}`,
		});
	}
	const keys = Object.keys(copied.value);
	const keySet = new Set(keys);
	if (
		keys.length !== options.inputKeys.length ||
		options.inputKeys.some((key) => !keySet.has(key))
	) {
		throw createGraphSchedulerError({
			code: 'invalid-input',
			message: 'Graph inputs must exactly cover the compiled input keys.',
		});
	}
	return copied.value as Readonly<Record<string, GraphValue>>;
};
