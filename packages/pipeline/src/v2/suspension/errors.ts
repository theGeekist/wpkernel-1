/**
 * Frozen tagged native error for a rejected suspension operation.
 * Resume and abandon throw this error when authority is absent or already spent.
 *
 * @public
 */
export type SuspensionError = Error & {
	readonly name: 'SuspensionError';
	readonly code: 'invalid-suspension' | 'already-consumed';
};

/**
 * Creates one tagged native suspension error without a runtime class.
 *
 * @param options         - Tagged suspension error options.
 * @param options.code    - Stable suspension error category.
 * @param options.message - Human-readable rejection detail.
 * @param options.cause   - Optional original cause.
 */
export const createSuspensionError = (options: {
	readonly code: SuspensionError['code'];
	readonly message: string;
	readonly cause?: unknown;
}): SuspensionError =>
	Object.freeze(
		Object.assign(new Error(options.message, { cause: options.cause }), {
			name: 'SuspensionError' as const,
			code: options.code,
		})
	);
