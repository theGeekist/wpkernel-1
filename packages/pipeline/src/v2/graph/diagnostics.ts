import type { GraphDiagnostic, GraphDiagnosticCode } from './types.js';

export const diagnostic = (
	code: GraphDiagnosticCode,
	message: string,
	path: readonly string[]
): GraphDiagnostic =>
	Object.freeze({
		code,
		message,
		path: Object.freeze([...path]),
	});
