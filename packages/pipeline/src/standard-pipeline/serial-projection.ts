import { readFinalisedSerialRun } from './serial-authority.js';
import type { SerialNativeOutcome, SerialRunOutcome } from './serial-types.js';

/**
 * Reads the original failure from a recognised effect failure algebra. @internal
 * @param value
 */
export function readEffectFailure(value: unknown): unknown {
	if (
		value &&
		typeof value === 'object' &&
		'participant' in value &&
		'phase' in value &&
		'kind' in value &&
		'error' in value &&
		(value.kind === 'declared' || value.kind === 'thrown')
	) {
		return value.error;
	}
	return value;
}

/**
 * Reads the original failure from a recognised graph failure algebra. @internal
 * @param value
 */
export function readGraphFailure(value: unknown): unknown {
	if (!isGraphFailure(value)) {
		return value;
	}
	if (value.kind === 'effect') {
		return readEffectFailure(value.error);
	}
	return new Set(['declared', 'thrown', 'contract']).has(String(value.kind))
		? value.error
		: value;
}

function isGraphFailure(
	value: unknown
): value is Record<'node' | 'nodeOrdinal' | 'kind' | 'error', unknown> {
	return (
		!!value &&
		typeof value === 'object' &&
		'node' in value &&
		'nodeOrdinal' in value &&
		'kind' in value &&
		'error' in value
	);
}

/**
 * Reads the original failure from a recognised native run algebra. @internal
 * @param value
 */
export const readNativeFailure = (value: unknown): unknown => {
	if (!value || typeof value !== 'object' || !('kind' in value)) {
		return value;
	}
	if (value.kind === 'admission-failed' && 'error' in value) {
		return value.error;
	}
	if (
		value.kind === 'failed' &&
		'primaryFailure' in value &&
		'nodes' in value &&
		'failures' in value
	) {
		return readGraphFailure(value.primaryFailure);
	}
	return value;
};

function projectNativeEvidence(value: unknown): SerialNativeOutcome {
	return value as SerialNativeOutcome;
}

function projectSucceeded<TRunResult>(
	value: unknown,
	handle: string | undefined
): SerialRunOutcome<TRunResult> {
	const finalised = readFinalisedSerialRun(handle ?? '');
	if (finalised?.kind === 'succeeded') {
		return Object.freeze({
			kind: 'succeeded',
			result: finalised.result as TRunResult,
			native: projectNativeEvidence(value),
		});
	}
	return Object.freeze({
		kind: 'failed',
		error:
			finalised?.kind === 'failed'
				? finalised.error
				: new Error('Serial result authority was not retained.'),
		native: projectNativeEvidence(value),
	});
}

function projectCancelled(value: unknown, outcome: Record<string, unknown>) {
	return Object.freeze({
		kind: 'cancelled' as const,
		native: projectNativeEvidence(value),
		...(Object.prototype.hasOwnProperty.call(outcome, 'reason')
			? { reason: outcome.reason }
			: {}),
	});
}

/**
 * Projects native evidence without exposing prepared or suspension authority. @internal
 * @param value
 * @param handle
 */
export const projectNativeOutcome = <TRunResult>(
	value: unknown,
	handle: string | undefined
): SerialRunOutcome<TRunResult> => {
	const outcome = value as Record<string, unknown>;
	if (outcome.kind === 'succeeded') {
		return projectSucceeded(value, handle);
	}
	if (outcome.kind === 'cancelled') {
		return projectCancelled(value, outcome);
	}
	if (outcome.kind === 'suspended') {
		return Object.freeze({
			kind: 'failed',
			error: new Error(
				'Native suspension is unsupported by serial compatibility runs.'
			),
		});
	}
	return Object.freeze({
		kind: 'failed',
		error: readNativeFailure(value),
		...('nodes' in outcome ? { native: projectNativeEvidence(value) } : {}),
	});
};
