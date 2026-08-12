import type { MaybePromise } from './types';

type ThenMethod = (
	onFulfilled: (value: unknown) => unknown,
	onRejected?: (reason: unknown) => unknown
) => unknown;

/**
 * Find a data-property `then` without invoking accessors or proxy traps.
 * Values that cannot be inspected safely remain synchronous data.
 *
 * @param value - Candidate value to inspect.
 */
function findThenMethod(value: unknown): ThenMethod | null {
	if (
		(typeof value !== 'object' || value === null) &&
		typeof value !== 'function'
	) {
		return null;
	}

	const seen = new Set<object>();
	let cursor: object | null = value;
	try {
		while (cursor !== null && !seen.has(cursor)) {
			seen.add(cursor);
			const descriptor = Object.getOwnPropertyDescriptor(cursor, 'then');
			if (descriptor !== undefined) {
				return 'value' in descriptor &&
					typeof descriptor.value === 'function'
					? (descriptor.value as ThenMethod)
					: null;
			}
			cursor = Object.getPrototypeOf(cursor);
		}
	} catch {
		return null;
	}
	return null;
}

/**
 * Adopt a previously inspected thenable without reading `.then` again.
 *
 * @param value - Original thenable receiver.
 * @param then  - Captured data-property method.
 */
function adoptThenable<T>(value: unknown, then: ThenMethod): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		try {
			then.call(value, resolve as (value: unknown) => unknown, reject);
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * Adopt a promise-like value using the exact `then` method found during safe
 * descriptor inspection. Returns `null` for synchronous values.
 *
 * @param value - A value that may or may not be promise-like
 * @returns An adopted native promise, or `null` when the value is synchronous
 *
 * @internal
 */
export function adoptMaybePromise<T>(
	value: MaybePromise<T>
):
	| { readonly promise: Promise<T>; readonly value?: never }
	| { readonly promise: null; readonly value: T } {
	const then = findThenMethod(value);
	return then === null
		? { promise: null, value: value as T }
		: { promise: adoptThenable<T>(value, then) };
}

/**
 * Type guard to check if a value is promise-like (has a `.then` method).
 *
 * @param value - The value to check
 * @returns `true` if the value has a `.then` method, `false` otherwise
 *
 * @internal
 */
export function isPromiseLike<T>(
	value: MaybePromise<T>
): value is PromiseLike<T>;
export function isPromiseLike(value: unknown): value is PromiseLike<unknown>;
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return findThenMethod(value) !== null;
}

/**
 * Conditionally chains a `.then()` call if the value is promise-like.
 *
 * If the value is a plain value, calls `onFulfilled` synchronously.
 * If the value is a promise, chains `.then()` asynchronously.
 *
 * @param value       - A value that may or may not be a promise
 * @param onFulfilled - The transformation to apply once the value is available
 * @returns Either the synchronous result or a promise of the result
 *
 * @internal
 */
export function maybeThen<T, TResult>(
	value: MaybePromise<T>,
	onFulfilled: (value: T) => MaybePromise<TResult>
): MaybePromise<TResult> {
	if (typeof onFulfilled !== 'function') {
		throw new TypeError('maybeThen: onFulfilled is not a function');
	}

	const adopted = adoptMaybePromise(value);
	if (adopted.promise !== null) {
		return adopted.promise.then(onFulfilled);
	}

	return onFulfilled(adopted.value);
}

/**
 * Try-catch wrapper that handles both synchronous and asynchronous errors.
 *
 * If `run()` throws synchronously or returns a rejected promise,
 * calls `onError` with the error.
 *
 * @param run     - The function to execute
 * @param onError - The error handler
 * @returns Either the successful result or the recovery value from `onError`
 *
 * @internal
 */
export function maybeTry<T>(
	run: () => MaybePromise<T>,
	onError: (error: unknown) => MaybePromise<T>
): MaybePromise<T> {
	try {
		const result = run();

		const adopted = adoptMaybePromise(result);
		if (adopted.promise !== null) {
			return adopted.promise.catch((error) => onError(error));
		}

		return adopted.value;
	} catch (error) {
		return onError(error);
	}
}

/**
 * Process an array of items sequentially (not in parallel).
 *
 * Handles both synchronous and asynchronous handlers. If a handler returns
 * a promise, waits for it to resolve before processing the next item.
 *
 * @param items     - The array of items to process
 * @param handler   - The function to call for each item
 * @param direction - Whether to process forward (0 → length) or reverse (length → 0)
 * @returns A promise if any handler is async, otherwise `void`
 *
 * @internal
 */
export function processSequentially<T>(
	items: readonly T[],
	handler: (item: T, index: number) => MaybePromise<void>,
	direction: 'forward' | 'reverse' = 'forward'
): MaybePromise<void> {
	const length = items.length;

	if (length === 0) {
		return;
	}

	const shouldContinue = (index: number) =>
		direction === 'forward' ? index < length : index >= 0;
	const advance = (index: number) =>
		direction === 'forward' ? index + 1 : index - 1;

	const iterate = (startIndex: number): MaybePromise<void> => {
		for (
			let index = startIndex;
			shouldContinue(index);
			index = advance(index)
		) {
			const item = items[index]!;
			const adopted = adoptMaybePromise(handler(item, index));
			if (adopted.promise !== null) {
				return adopted.promise.then(() => iterate(advance(index)));
			}
		}
	};

	const start = direction === 'forward' ? 0 : length - 1;

	return iterate(start);
}

/**
 * Resolves maybe-promise values together while preserving the synchronous path
 * when every value is already available.
 *
 * Each thenable is adopted with the exact data-property method captured during
 * descriptor inspection.
 *
 * @param values - Values to resolve
 * @returns The values directly, or a promise when any value is asynchronous
 * @public
 */
export function maybeAll<T>(
	values: readonly MaybePromise<T>[]
): MaybePromise<T[]> {
	const adopted = values.map(adoptMaybePromise);
	if (adopted.every((entry) => entry.promise === null)) {
		return adopted.map((entry) => entry.value as T);
	}

	return Promise.all(
		adopted.map((entry) =>
			entry.promise === null ? entry.value : entry.promise
		)
	);
}
