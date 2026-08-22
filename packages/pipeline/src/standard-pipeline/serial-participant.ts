import { observeParticipant } from '../v2/scheduler/maybe-promise.js';
import {
	openSerialRun,
	readPreparedSerialRun,
	readSerialRun,
	retainFinalisedSerialRun,
	retainPreparedSerialRun,
	type PreparedSerialRun,
} from './serial-authority.js';
import { evaluateSerialRun } from './serial-prepare.js';
import { invokeSerialResult, projectSerialResult } from './serial-evaluator.js';
import { commitSerialRun, compensateSerialRun } from './serial-settlement.js';

/**
 * Native before middleware for one compatibility run. @internal
 * @param options
 */
export function serialBefore(options: unknown) {
	const invocation = (
		options as {
			readonly invocation: {
				readonly capabilities: {
					readonly run: Parameters<typeof openSerialRun>[0];
				};
			};
		}
	).invocation;
	const handle = openSerialRun(invocation.capabilities.run);
	return Object.freeze({
		state: handle,
		effects: Object.freeze([
			Object.freeze({ participant: 'serial.evaluate', payload: handle }),
		]),
	});
}

/**
 * Native node projection for one prepared compatibility run. @internal
 * @param options
 */
export function serialNodeExecutor(options: unknown) {
	const run = (
		options as {
			readonly capabilities: {
				readonly run: { readonly handle?: string };
			};
		}
	).capabilities.run;
	const prepared = readPreparedSerialRun(run.handle ?? '');
	if (!prepared) {
		return Object.freeze({
			kind: 'failure' as const,
			error: new Error(
				'Serial compatibility preparation was not retained.'
			),
		});
	}
	return prepared.outcome.kind === 'failed'
		? Object.freeze({
				kind: 'failure' as const,
				error: prepared.outcome.error,
			})
		: Object.freeze({
				kind: 'success' as const,
				output: prepared.handle,
				effects: Object.freeze([]),
			});
}

/**
 * Prepares the aggregate serial effect. @internal
 * @param options
 */
export function prepareSerialEffect(options: unknown) {
	const handle = (options as { readonly payload: string }).payload;
	const run = readSerialRun(handle);
	if (!run) {
		return Object.freeze({
			kind: 'failure' as const,
			error: new Error(`Unknown serial run handle "${handle}".`),
		});
	}
	const observed = observeParticipant<PreparedSerialRun>(
		evaluateSerialRun(run, handle)
	);
	if (observed.kind === 'failed') {
		return Object.freeze({
			kind: 'failure' as const,
			error: observed.error,
		});
	}
	if (observed.kind === 'synchronous') {
		retainPreparedSerialRun(observed.value);
		return Object.freeze({
			kind: 'success' as const,
			value: observed.value,
		});
	}
	return observed.promise.then(
		(prepared) => {
			retainPreparedSerialRun(prepared);
			return Object.freeze({ kind: 'success' as const, value: prepared });
		},
		(error: unknown) => Object.freeze({ kind: 'failure' as const, error })
	);
}

/**
 * Commits the aggregate serial effect. @internal
 * @param prepared
 */
function finaliseCommittedSerialRun(prepared: PreparedSerialRun) {
	let returned: unknown;
	try {
		returned = invokeSerialResult(
			prepared.authority,
			prepared.resultOptions as Record<string, unknown>
		);
	} catch (error) {
		retainFinalisedSerialRun(prepared.handle, { kind: 'failed', error });
		return Object.freeze({ kind: 'failure' as const, error });
	}
	const observed = observeParticipant<unknown>(returned);
	if (observed.kind === 'failed') {
		retainFinalisedSerialRun(prepared.handle, {
			kind: 'failed',
			error: observed.error,
		});
		return Object.freeze({
			kind: 'failure' as const,
			error: observed.error,
		});
	}
	if (observed.kind === 'synchronous') {
		try {
			const result = projectSerialResult(
				prepared.authority,
				observed.value
			);
			retainFinalisedSerialRun(prepared.handle, {
				kind: 'succeeded',
				result,
			});
			return Object.freeze({ kind: 'success' as const, value: null });
		} catch (error) {
			retainFinalisedSerialRun(prepared.handle, {
				kind: 'failed',
				error,
			});
			return Object.freeze({ kind: 'failure' as const, error });
		}
	}
	return observed.promise.then(
		(value) => {
			try {
				const result = projectSerialResult(prepared.authority, value);
				retainFinalisedSerialRun(prepared.handle, {
					kind: 'succeeded',
					result,
				});
				return Object.freeze({ kind: 'success' as const, value: null });
			} catch (error) {
				retainFinalisedSerialRun(prepared.handle, {
					kind: 'failed',
					error,
				});
				return Object.freeze({ kind: 'failure' as const, error });
			}
		},
		(error: unknown) => {
			retainFinalisedSerialRun(prepared.handle, {
				kind: 'failed',
				error,
			});
			return Object.freeze({ kind: 'failure' as const, error });
		}
	);
}

/**
 * Commits the aggregate serial effect, then materialises the public result. @internal
 * @param options
 */
export function commitSerialEffect(options: unknown) {
	const prepared = (options as { readonly prepared: PreparedSerialRun })
		.prepared;
	const observed = observeParticipant(commitSerialRun(prepared));
	if (observed.kind === 'failed') {
		return Object.freeze({
			kind: 'failure' as const,
			error: observed.error,
		});
	}
	if (observed.kind === 'synchronous') {
		return finaliseCommittedSerialRun(prepared);
	}
	return observed.promise.then(
		() => finaliseCommittedSerialRun(prepared),
		(error: unknown) => Object.freeze({ kind: 'failure' as const, error })
	);
}

/**
 * Compensates the aggregate serial effect. @internal
 * @param options
 */
export function compensateSerialEffect(options: unknown) {
	const prepared = (options as { readonly prepared: PreparedSerialRun })
		.prepared;
	const observed = observeParticipant(compensateSerialRun(prepared));
	if (observed.kind === 'failed') {
		return Object.freeze({
			kind: 'failure' as const,
			error: observed.error,
		});
	}
	if (observed.kind === 'synchronous') {
		return Object.freeze({ kind: 'success' as const, value: undefined });
	}
	return observed.promise.then(
		() => Object.freeze({ kind: 'success' as const, value: undefined }),
		(error: unknown) => Object.freeze({ kind: 'failure' as const, error })
	);
}
