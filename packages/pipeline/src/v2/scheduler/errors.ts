/** A scheduler boundary or node-result contract failure. */
export type GraphSchedulerError = Error & {
	readonly name: 'GraphSchedulerError';
	readonly code:
		| 'invalid-input'
		| 'invalid-graph'
		| 'invalid-node-result'
		| 'invalid-middleware'
		| 'invalid-observer'
		| 'invalid-participant'
		| 'invalid-effect-result';
};

/**
 * Creates one immutable tagged native scheduler contract error.
 *
 * @param options         - Complete scheduler failure details.
 * @param options.code    - Stable scheduler failure category.
 * @param options.message - Human-readable failure detail.
 * @param options.cause   - Optional original failure.
 */
export const createGraphSchedulerError = (options: {
	readonly code: GraphSchedulerError['code'];
	readonly message: string;
	readonly cause?: unknown;
}): GraphSchedulerError =>
	Object.freeze(
		Object.assign(new Error(options.message, { cause: options.cause }), {
			name: 'GraphSchedulerError' as const,
			code: options.code,
		})
	);
