import type { PhpProgram } from '../nodes';

/**
 * Stable discriminator for the framework-neutral PHP JSON AST envelope.
 */
export const PHP_JSON_AST_FORMAT = 'php-json-ast' as const;

/**
 * Current canonical envelope and normalization contract version.
 */
export const PHP_JSON_AST_VERSION = 1 as const;

export interface PhpJsonAstEnvelopeV1 {
	readonly format: typeof PHP_JSON_AST_FORMAT;
	readonly version: typeof PHP_JSON_AST_VERSION;
	readonly program: PhpProgram;
}

export type PhpJsonAstEnvelope = PhpJsonAstEnvelopeV1;

export type PhpJsonAstCodecErrorCode =
	| 'INVALID_JSON'
	| 'MALFORMED_ENVELOPE'
	| 'UNSUPPORTED_VERSION'
	| 'INVALID_PROGRAM'
	| 'NON_JSON_VALUE';

export class PhpJsonAstCodecError extends Error {
	public constructor(
		public readonly code: PhpJsonAstCodecErrorCode,
		message: string
	) {
		super(message);
		this.name = 'PhpJsonAstCodecError';
	}
}
