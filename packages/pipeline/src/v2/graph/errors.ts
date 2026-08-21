import type { GraphDiagnostic } from './types.js';

/** A typed failure for callers that prefer exception-oriented compilation. */
export class GraphCompilationError extends Error {
	readonly diagnostics: readonly GraphDiagnostic[];

	constructor(options: { readonly diagnostics: readonly GraphDiagnostic[] }) {
		super(
			options.diagnostics
				.map((diagnostic) => diagnostic.message)
				.join(' ')
		);
		this.name = 'GraphCompilationError';
		this.diagnostics = options.diagnostics;
	}
}
