type ThenMethod = (
	onFulfilled: (value: unknown) => unknown,
	onRejected: (reason: unknown) => unknown
) => unknown;

export type ObservedMaybePromise<T> =
	| { readonly kind: 'synchronous'; readonly value: T }
	| { readonly kind: 'asynchronous'; readonly promise: Promise<T> }
	| { readonly kind: 'failed'; readonly error: unknown };

function adoptCapturedThen<T>(value: object, then: ThenMethod): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		queueMicrotask(() => {
			try {
				Reflect.apply(then, value, [resolve, reject]);
			} catch (error) {
				reject(error);
			}
		});
	});
}

export function observeMaybePromise<T>(
	value: unknown
): ObservedMaybePromise<T> {
	if (
		(typeof value !== 'object' || value === null) &&
		typeof value !== 'function'
	) {
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
}
