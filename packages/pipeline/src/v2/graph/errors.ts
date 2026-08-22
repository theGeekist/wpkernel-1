import type { GraphDiagnostic } from './types.js';

/** A typed failure for callers that prefer exception-oriented compilation. */
export type GraphCompilationError = Error & {
	readonly name: 'GraphCompilationError';
	readonly diagnostics: readonly GraphDiagnostic[];
};

/**
 * Creates one immutable tagged native graph-compilation error.
 *
 * @param options             - Complete compilation failure details.
 * @param options.diagnostics - Retained immutable compiler diagnostics.
 * @param options.cause       - Optional original failure.
 */
export const createGraphCompilationError = (options: {
	readonly diagnostics: readonly GraphDiagnostic[];
	readonly cause?: unknown;
}): GraphCompilationError => {
	const diagnostics = Object.freeze(
		options.diagnostics.map((diagnostic) =>
			Object.freeze({
				...diagnostic,
				path: Object.freeze([...diagnostic.path]),
			})
		)
	);
	return Object.freeze(
		Object.assign(
			new Error(
				diagnostics.map((diagnostic) => diagnostic.message).join(' '),
				{ cause: options.cause }
			),
			{
				name: 'GraphCompilationError' as const,
				diagnostics,
			}
		)
	);
};
