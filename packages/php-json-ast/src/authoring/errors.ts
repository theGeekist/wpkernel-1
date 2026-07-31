export type PhpAuthoringErrorCode =
	| 'AMBIGUOUS_VALUE'
	| 'CYCLIC_VALUE'
	| 'INVALID_EXPRESSION'
	| 'INVALID_IDENTIFIER'
	| 'INVALID_STATEMENT'
	| 'INVALID_VARIABLE_REFERENCE'
	| 'NON_FINITE_NUMBER'
	| 'UNSAFE_INTEGER'
	| 'UNSUPPORTED_VALUE';

export interface PhpAuthoringErrorOptions {
	readonly code: PhpAuthoringErrorCode;
	readonly path: string;
	readonly message: string;
	readonly hint?: string;
}

/**
 * A framework-neutral authoring error with a stable machine-readable code.
 */
export class PhpAuthoringError extends Error {
	public readonly code: PhpAuthoringErrorCode;
	public readonly path: string;
	public readonly hint?: string;

	/**
	 * @param options - Structured error details.
	 */
	public constructor(options: PhpAuthoringErrorOptions) {
		super(formatMessage(options));
		this.name = 'PhpAuthoringError';
		this.code = options.code;
		this.path = options.path;
		this.hint = options.hint;
	}
}

function formatMessage(options: PhpAuthoringErrorOptions): string {
	const location = options.path ? ` at ${options.path}` : '';
	const hint = options.hint ? ` ${options.hint}` : '';
	return `${options.message}${location}.${hint}`;
}
