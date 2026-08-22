import type { MaybePromise } from './types.js';

type ThenMethod = (
	onFulfilled: (value: unknown) => unknown,
	onRejected?: (reason: unknown) => unknown
) => unknown;

/**
 * Read `then` once through ordinary JavaScript property access.
 *
 * @param value - Candidate value to observe.
 */
function readThenMethod(value: unknown): ThenMethod | null {
	if (
		(typeof value !== 'object' || value === null) &&
		typeof value !== 'function'
	) {
		return null;
	}
	const then = Reflect.get(value, 'then') as unknown;
	return typeof then === 'function' ? (then as ThenMethod) : null;
}

/**
 * Adopt a previously inspected thenable without reading `.then` again.
 *
 * @param value - Original thenable receiver.
 * @param then  - Captured method.
 */
function adoptThenable<T>(value: unknown, then: ThenMethod): Promise<T> {
	return new Promise<T>((resolve, reject) => {
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
}

/**
 * Fresh mutable tuple of recursively awaited fulfilment values.
 *
 * Literal positions and their distinct fulfilled value types are preserved;
 * readonly input positions become mutable because settlement creates a new
 * array and never returns the caller's tuple.
 *
 * @public
 */
export type AwaitedTuple<TValues extends readonly unknown[]> = {
	-readonly [K in keyof TValues]: Awaited<TValues[K]>;
};

/**
 * Adopt a promise-like value using the exact `then` method observed through
 * one ordinary property read. The returned record carries `promise: null` for
 * synchronous values. A throwing `then` getter remains a synchronous throw for
 * the caller to compose through {@link maybeTry} when recovery is required.
 *
 * @param value - A value that may or may not be promise-like
 * @returns A tagged record containing either the direct value or its adopted native promise.
 *
 * @public
 */
export function adoptMaybePromise<T>(
	value: MaybePromise<T>
):
	| { readonly promise: Promise<T>; readonly value?: never }
	| { readonly promise: null; readonly value: T } {
	const then = readThenMethod(value);
	return then === null
		? { promise: null, value: value as T }
		: { promise: adoptThenable<T>(value, then) };
}

/**
 * Tests whether a value exposes a callable `then` through one ordinary
 * property read. Accessors and proxy traps therefore follow JavaScript's normal
 * semantics and may throw synchronously.
 *
 * @param value - Candidate synchronous value or thenable.
 * @returns `true` only when that read observes a callable `then`.
 *
 * @example
 * ```ts
 * isPromiseLike(Promise.resolve('ready')); // true
 * isPromiseLike('ready'); // false
 * ```
 *
 * @public
 */
export function isPromiseLike<T>(
	value: MaybePromise<T>
): value is PromiseLike<T>;
export function isPromiseLike(value: unknown): value is PromiseLike<unknown>;
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return readThenMethod(value) !== null;
}

/**
 * Maps a synchronous value or structurally valid thenable while preserving the
 * synchronous path.
 *
 * For synchronous input, `onFulfilled` runs before this function returns and
 * its value is returned directly. Throws from that callback remain synchronous.
 * For a thenable, the captured method is adopted exactly
 * once into a native promise; callback throws then become promise rejections.
 * A throwing `then` getter remains a synchronous throw.
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
 * @public
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

	const mapped = adoptMaybePromise(onFulfilled(adopted.value));
	return mapped.promise === null ? mapped.value : mapped.promise;
}

/**
 * Runs an operation and recovers from either a synchronous throw or a rejected
 * thenable.
 *
 * A successful synchronous result is returned directly. A synchronous throw
 * calls `onError` immediately, so a synchronous recovery also remains
 * synchronous. Once `run` returns a thenable, the outcome is a native promise
 * and recovery runs through its rejection channel. The recovery function may
 * itself return a value or thenable.
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
 * @public
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
		const recovered = adoptMaybePromise(onError(error));
		return recovered.promise === null ? recovered.value : recovered.promise;
	}
}

/**
 * Processes items in order without promoting an entirely synchronous traversal
 * to a promise.
 *
 * Synchronous handlers run in the current call stack. After the first thenable
 * result, later items run only after that result settles. Each handler result
 * crosses the shared read-once thenable boundary. A synchronous throw or
 * throwing `then` getter stops traversal synchronously; after promotion, a
 * failure rejects the returned native promise and no later item is admitted.
 *
 * @param items     - Ordered items to visit.
 * @param handler   - Operation invoked once for each admitted item.
 * @param direction - Whether to visit from the first item or the last.
 * @returns `void` for a synchronous traversal, or a native promise after asynchronous promotion.
 *
 * @example
 * ```ts
 * const visited: number[] = [];
 * const result = processSequentially([1, 2], (value) => {
 *   visited.push(value);
 * });
 * isPromiseLike(result); // false
 * ```
 *
 * @public
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
 * Resolves an ordered collection of values and thenables.
 *
 * If every entry is synchronous, this returns a new array immediately. If any
 * entry is asynchronous, all captured thenables are adopted and the function
 * returns a native `Promise` with `Promise.all` ordering and rejection
 * semantics. Input order is preserved in both paths.
 *
 * Each value crosses the same read-once boundary as {@link isPromiseLike}.
 * A throwing getter remains a synchronous throw.
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
 * @public
 */
export function maybeAll<const TValues extends readonly unknown[]>(
	values: TValues
): MaybePromise<AwaitedTuple<TValues>> {
	const adopted = values.map(adoptMaybePromise);
	if (adopted.every((entry) => entry.promise === null)) {
		return adopted.map((entry) => entry.value) as AwaitedTuple<TValues>;
	}

	return Promise.all(
		adopted.map((entry) =>
			entry.promise === null
				? { value: entry.value }
				: entry.promise.then((value) => ({ value }))
		)
	).then(
		(entries) =>
			entries.map((entry) => entry.value) as AwaitedTuple<TValues>
	);
}
