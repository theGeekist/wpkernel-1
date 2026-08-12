/**
 * Factory function for creating errors.
 * Allows the pipeline to be framework-agnostic.
 *
 * @param code    - Error code (e.g., 'ValidationError', 'RuntimeError')
 * @param message - Error message
 * @returns An Error instance
 *
 * @example
 * ```typescript
 * const createError = (code: string, message: string) =>
 *   new MyCustomError(code, { message });
 * ```
 */
export type ErrorFactory = (code: string, message: string) => Error;

/**
 * Default error factory that creates standard Error instances with code property.
 *
 * @param code    - Error code
 * @param message - Error message
 * @returns A standard Error with code property and prefixed message
 */
export function createDefaultError(code: string, message: string): Error {
	const error = new Error(`[${code}] ${message}`);
	(error as Error & { code: string }).code = code;
	return error;
}
