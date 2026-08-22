import type { MaybePromise } from './types.js';

type ThenMethod = (
	onFulfilled: (value: unknown) => unknown,
	onRejected?: (reason: unknown) => unknown
) => unknown;

/**
 * Find a data-property `then` without reading it through ordinary property
 * access. Descriptor and prototype traps are contained; values that cannot be
 * inspected remain synchronous data.
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
 * Adopt a promise-like value using the exact `then` method found during
 * guarded descriptor inspection. Returns `null` for synchronous values.
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
 * Tests whether a value exposes an inspectable data-property `then` method.
 *
 * This is the same hardened boundary used by {@link maybeThen},
 * {@link maybeTry} and {@link maybeAll}. It walks own and prototype property
 * descriptors without evaluating a `then` accessor or reading `value.then`.
 * Proxy descriptor and prototype traps may run as part of inspection; if they
 * throw, the exception is contained and the value is treated as synchronous
 * data. An accessor-backed `then` is also treated as data rather than invoked.
 *
 * This intentionally differs from ordinary JavaScript promise assimilation,
 * which reads `value.then` and may execute user code. The guard is suitable at
 * native or hostile-object boundaries where inspecting an accessor would grant
 * ambient execution.
 *
 * @param value - Candidate synchronous value or thenable.
 * @returns `true` only for a safely captured data-property `then` function.
 *
 * @example
 * ```ts
 * const accessorBacked = Object.defineProperty({}, 'then', {
 *   get() {
 *     throw new Error('must not execute');
 *   },
 * });
 *
 * isPromiseLike(Promise.resolve('ready')); // true
 * isPromiseLike(accessorBacked); // false, getter was not evaluated
 * ```
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
 * Maps a synchronous value or safely inspectable thenable while preserving the
 * synchronous path.
 *
 * For synchronous input, `onFulfilled` runs before this function returns and
 * its value is returned directly. Throws from that callback remain synchronous.
 * For a safely inspectable thenable, the captured method is adopted exactly
 * once into a native promise; callback throws then become promise rejections.
 * Accessor-backed or trap-hostile `then` properties remain ordinary data under
 * the boundary described by {@link isPromiseLike}.
 *
 * @param value       - Value or thenable to map.
 * @param onFulfilled - Transformation applied to the fulfilled value.
 * @returns The callback result directly for synchronous input, or a native chained promise for thenable input.
 *
 * @example
 * ```ts
 * const immediate = maybeThen(2, (value) => value * 3);
 * isPromiseLike(immediate); // false
 *
 * const deferred = maybeThen(Promise.resolve(2), (value) => value * 3);
 * isPromiseLike(deferred); // true
 * ```
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
 * Runs an operation and recovers from either a synchronous throw or a rejected
 * safely inspectable thenable.
 *
 * A successful synchronous result is returned directly. A synchronous throw
 * calls `onError` immediately, so a synchronous recovery also remains
 * synchronous. Once `run` returns a thenable, the outcome is a native promise
 * and recovery runs through its rejection channel. The recovery function may
 * itself return a value or thenable.
 *
 * Values excluded by the hardened boundary in {@link isPromiseLike} are
 * successful synchronous data, even when they expose an accessor named `then`.
 *
 * @param run     - Operation to execute.
 * @param onError - Recovery invoked with the original failure.
 * @returns The successful result or recovery result, preserving sync when possible.
 *
 * @example
 * ```ts
 * const parsed = maybeTry(
 *   () => JSON.parse('{invalid}') as unknown,
 *   () => ({ valid: false })
 * );
 * ```
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
 * Resolves an ordered collection of values and safely inspectable thenables.
 *
 * If every entry is synchronous, this returns a new array immediately. If any
 * entry is asynchronous, all captured thenables are adopted and the function
 * returns a native `Promise` with `Promise.all` ordering and rejection
 * semantics. Input order is preserved in both paths.
 *
 * Each value crosses the same descriptor boundary as {@link isPromiseLike}.
 * Accessor-backed or uninspectable `then` properties remain synchronous data.
 *
 * @param values - Ordered values to resolve.
 * @returns A new array directly, or a native promise when any entry is asynchronous.
 *
 * @example
 * ```ts
 * const immediate = maybeAll([1, 2, 3]);
 * isPromiseLike(immediate); // false
 *
 * const deferred = maybeAll([1, Promise.resolve(2), 3]);
 * isPromiseLike(deferred); // true
 * ```
 *
 * @internal
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
