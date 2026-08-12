/**
 * Creates the domain error thrown for pipeline validation and runtime failures.
 *
 * Supply an `ErrorFactory` through a pipeline's `createError` option when a
 * host needs its own error subclass, machine-readable code or observability
 * metadata. The pipeline treats `code` as an opaque category and preserves the
 * returned `Error` as the failure object. The surrounding run determines
 * whether that failure is thrown synchronously or becomes a rejection. The
 * factory itself is synchronous and should be deterministic.
 *
 * Returning an `Error` does not require throwing it inside the factory. The
 * pipeline owns the eventual throw and preserves the returned instance.
 *
 * @param    code    - Pipeline error category, such as `ValidationError`.
 * @param    message - Complete human-readable failure description.
 * @returns An error instance for the pipeline to throw.
 *
 * @example
 * ```ts
 * import {
 *   makePipeline,
 *   type ErrorFactory,
 *   type PipelineReporter,
 * } from '@wpkernel/pipeline';
 *
 * class HostError extends Error {
 *   constructor(readonly code: string, message: string) {
 *     super(message);
 *   }
 * }
 *
 * const createError: ErrorFactory = (code, message) =>
 *   new HostError(code, message);
 *
 * const pipeline = makePipeline({
 *   helperKinds: [],
 *   createContext: () => ({ reporter: {} as PipelineReporter }),
 *   createError,
 * });
 * ```
 *
 * @category Pipeline
 * @public
 */
export type ErrorFactory = (code: string, message: string) => Error;

/**
 * Creates the internal default `Error` with a prefixed message and `code`
 * property.
 *
 * @param code    - Pipeline error category.
 * @param message - Human-readable failure description.
 * @returns A standard error carrying the supplied code.
 * @internal
 */
export function createDefaultError(code: string, message: string): Error {
	const error = new Error(`[${code}] ${message}`);
	(error as Error & { code: string }).code = code;
	return error;
}
