import type { SerialEvaluationState } from './serial-ordering.js';
import { invokePublic } from './serial-invoke.js';

export function hasControlFlag(
	value: unknown,
	flag: '__halt' | '__paused'
): value is Record<string, unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		Reflect.get(value, flag) === true
	);
}

export function rejectUnsupportedPause(
	state: Pick<SerialEvaluationState, 'authority'>,
	value: unknown
): void {
	if (hasControlFlag(value, '__paused')) {
		throw invokePublic(
			state.authority.createError,
			'ValidationError',
			'Serial compatibility programmes cannot pause or resume.'
		);
	}
}

export function rejectNonTerminalHalt(
	state: Pick<SerialEvaluationState, 'authority'>,
	value: unknown
): void {
	if (hasControlFlag(value, '__halt')) {
		throw invokePublic(
			state.authority.createError,
			'ValidationError',
			'Serial compatibility halts are only valid as terminal run results.'
		);
	}
}
