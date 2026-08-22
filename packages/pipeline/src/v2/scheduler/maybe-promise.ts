import { adoptMaybePromise } from '../../core/async-utils.js';
import type { MaybePromise } from '../graph/types.js';

export type ObservedParticipant<T> =
	| { readonly kind: 'synchronous'; readonly value: T }
	| { readonly kind: 'asynchronous'; readonly promise: Promise<T> }
	| { readonly kind: 'failed'; readonly error: unknown };

/**
 * Observes a participant return exactly once. Callable `then` promotes the
 * run; a throwing getter remains a synchronous participant failure.
 *
 * @param value - Untrusted participant return.
 */
export const observeParticipant = <T>(
	value: unknown
): ObservedParticipant<T> => {
	try {
		const adopted = adoptMaybePromise<T>(value as MaybePromise<T>);
		return adopted.promise === null
			? { kind: 'synchronous', value: adopted.value }
			: { kind: 'asynchronous', promise: adopted.promise };
	} catch (error) {
		return { kind: 'failed', error };
	}
};

/**
 * Invokes one participant without binding interpreter authority as `this`.
 *
 * @param participant - Participant phase callable.
 * @param options     - Immutable phase options.
 */
export const invokeParticipant = <T>(
	participant: (...options: never[]) => unknown,
	options: unknown
): ObservedParticipant<T> => {
	let returned: unknown;
	try {
		returned = Reflect.apply(participant, undefined, [options]);
	} catch (error) {
		return { kind: 'failed', error };
	}
	return observeParticipant<T>(returned);
};
