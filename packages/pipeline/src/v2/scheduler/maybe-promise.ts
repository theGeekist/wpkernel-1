type ThenMethod = (
	onFulfilled: (value: unknown) => unknown,
	onRejected: (reason: unknown) => unknown
) => unknown;

export type ObservedParticipant<T> =
	| { readonly kind: 'synchronous'; readonly value: T }
	| { readonly kind: 'asynchronous'; readonly promise: Promise<T> }
	| { readonly kind: 'failed'; readonly error: unknown };

type ThenCandidate = { readonly then?: unknown };

const isThenCandidate = (value: unknown): value is ThenCandidate =>
	(typeof value === 'object' && value !== null) ||
	typeof value === 'function';

const adoptCapturedThen = <T>(
	value: ThenCandidate,
	then: ThenMethod
): Promise<T> =>
	new Promise<T>((resolve, reject) => {
		queueMicrotask(() => {
			try {
				Reflect.apply(then, value, [
					resolve as (resolved: unknown) => unknown,
					reject,
				]);
			} catch (error) {
				reject(error);
			}
		});
	});

/**
 * Observes a participant return exactly once. Callable `then` promotes the
 * run; a throwing getter remains a synchronous participant failure.
 *
 * @param value - Untrusted participant return.
 */
export const observeParticipant = <T>(
	value: unknown
): ObservedParticipant<T> => {
	if (!isThenCandidate(value)) {
		return { kind: 'synchronous', value: value as T };
	}
	let then: unknown;
	try {
		then = (value as { readonly then?: unknown }).then;
	} catch (error) {
		return { kind: 'failed', error };
	}
	return typeof then === 'function'
		? {
				kind: 'asynchronous',
				promise: adoptCapturedThen<T>(value, then as ThenMethod),
			}
		: { kind: 'synchronous', value: value as T };
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
