import { maybeThen, maybeTry, processSequentially } from './async-utils.js';
import type { MaybePromise } from './types.js';

/**
 * Best-effort diagnostic metadata extracted from a rollback failure.
 *
 * Every field is optional because hostile `Error` instances can throw while
 * their properties are inspected. Metadata extraction never replaces the
 * original rollback error and never interrupts the remaining cleanup.
 * String failures populate only `message`; values that cannot be safely read
 * produce an empty object.
 *
 * @see {@link PipelineRollback}
 * @see {@link createPipelineRollback}
 * @internal
 */
export interface PipelineRollbackErrorMetadata {
	/** Error constructor name when it can be read safely. */
	readonly name?: string;
	/** Error or string failure message when it can be read safely. */
	readonly message?: string;
	/** Captured stack text when the failure exposes one safely. */
	readonly stack?: string;
	/** Original causal value from an `Error` with a readable `cause`. */
	readonly cause?: unknown;
}

/**
 * A named cleanup operation captured after successful helper execution.
 *
 * Helper rollbacks are admitted only after the helper settles successfully.
 * Extension hook rollback functions use the same execution machinery. On a
 * later pipeline failure, admitted operations run sequentially in reverse
 * execution chronology. This gives nested and dependency-ordered work LIFO
 * cleanup semantics.
 *
 * Rollback is best effort. A failing operation is reported through the
 * pipeline's rollback observer, then the remaining older operations are still
 * attempted. Failures thrown by that observer are also contained. The original
 * pipeline failure remains primary.
 *
 * Construct descriptors with {@link createPipelineRollback}. `key` and `label`
 * are diagnostic metadata and do not affect order or execution.
 *
 * @example
 * ```ts
 * const allocations = new Set(['temporary']);
 * const rollback: PipelineRollback = createPipelineRollback(
 *   () => allocations.delete('temporary'),
 *   { key: 'allocate', label: 'Release temporary allocation' }
 * );
 * ```
 *
 * @internal
 */
export interface PipelineRollback {
	/** Stable machine-readable owner key for diagnostics. */
	readonly key?: string;
	/** Human-readable cleanup description for observers. */
	readonly label?: string;
	/** Cleanup operation invoked at most once by one rollback traversal. */
	readonly run: () => unknown | Promise<unknown>;
}

/**
 * Internal options for best-effort rollback observation.
 * @internal
 */
export interface RunRollbackStackOptions {
	readonly onError?: (args: {
		readonly error: unknown;
		readonly entry: PipelineRollback;
		readonly metadata: PipelineRollbackErrorMetadata;
	}) => void;
}

/**
 * Creates a {@link PipelineRollback} descriptor for helper-owned cleanup.
 *
 * This function performs no work and does not register the descriptor by
 * itself. Return it as `rollback` from a helper result; the pipeline admits it
 * only when that helper settles successfully. Admitted operations run in
 * reverse execution chronology if a later stage fails.
 *
 * The returned descriptor is a shallow object containing the original `run`
 * function and optional diagnostic metadata. It is not frozen. A synchronous
 * `run` keeps rollback on the synchronous path until an asynchronous cleanup is
 * encountered. Cleanup failures are contained by the pipeline so older
 * rollbacks are still attempted, while the original run error remains primary.
 *
 * @param    run           - Cleanup to invoke if later pipeline work fails.
 * @param    options       - Optional identity for diagnostics and rollback observers.
 * @param    options.key   - Stable machine-readable owner key.
 * @param    options.label - Human-readable cleanup description.
 * @returns A rollback descriptor containing the supplied function and metadata.
 *
 * @example
 * ```ts
 * type Context = {
 *   reporter: PipelineReporter;
 *   cache: Map<string, string>;
 * };
 *
 * const cacheResult = createHelper<Context, void, string>({
 *   key: 'cache-result',
 *   kind: 'build',
 *   apply: ({ context, output }) => {
 *     const previous = context.cache.get('result');
 *     context.cache.set('result', output);
 *
 *     return {
 *       rollback: createPipelineRollback(
 *         () => {
 *           if (previous === undefined) context.cache.delete('result');
 *           else context.cache.set('result', previous);
 *         },
 *         { key: 'cache-result', label: 'Restore cached result' }
 *       ),
 *     };
 *   },
 * });
 * ```
 *
 * @category Pipeline
 * @internal
 */
export function createPipelineRollback(
	run: () => unknown | Promise<unknown>,
	options: {
		readonly key?: string;
		readonly label?: string;
	} = {}
): PipelineRollback {
	return { run, ...options };
}

/**
 * Converts an error into a serializable metadata object.
 *
 * Extracts `name`, `message`, `stack`, and `cause` from Error instances.
 * Falls back to a plain message string for non-Error values.
 *
 * @param error - The error to convert
 * @returns Serializable error metadata
 *
 * @internal
 */
export function createRollbackErrorMetadata(
	error: unknown
): PipelineRollbackErrorMetadata {
	if (typeof error === 'string') {
		return {
			message: error,
		};
	}

	try {
		if (error instanceof Error) {
			const { name, message, stack } = error;
			const cause = (error as Error & { cause?: unknown }).cause;

			return {
				name,
				message,
				stack,
				cause,
			};
		}
	} catch {
		// Error metadata is diagnostic only and must not interrupt rollback.
	}

	return {};
}

/**
 * Executes a stack of rollback operations in reverse order.
 *
 * Each rollback is executed sequentially in reverse (LIFO) order. If any rollback fails,
 * the error is reported via the onError callback but execution continues with remaining
 * rollbacks. This ensures all cleanup functions are attempted even if some fail.
 *
 * @param entries - The rollback entries to execute in reverse order
 * @param options - Optional best-effort rollback error observer
 * @returns A promise if any rollback is async, otherwise `void`
 *
 * @internal
 */
export function runRollbackStack(
	entries: readonly PipelineRollback[],
	options: RunRollbackStackOptions
): MaybePromise<void> {
	return processSequentially(
		entries,
		(entry) =>
			maybeTry<void>(
				() => maybeThen(entry.run(), () => undefined),
				(error) => {
					const metadata = createRollbackErrorMetadata(error);

					try {
						options.onError?.({
							error,
							entry,
							metadata,
						});
					} catch {
						// Observers cannot prevent the remaining cleanup attempts.
					}

					return undefined;
				}
			),
		'reverse'
	);
}
