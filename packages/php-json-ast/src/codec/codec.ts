import type { PhpProgram } from '../nodes';
import { normalizePhpJsonAst } from './normalize';
import {
	PHP_JSON_AST_FORMAT,
	PHP_JSON_AST_VERSION,
	PhpJsonAstCodecError,
	type PhpJsonAstEnvelopeV1,
} from './protocol';

const ENVELOPE_KEYS = ['format', 'program', 'version'] as const;

/**
 * Create a validated, normalized version-one envelope.
 *
 * @param program - Candidate PHP program.
 */
export function createPhpJsonAstEnvelope(
	program: unknown
): PhpJsonAstEnvelopeV1 {
	return {
		format: PHP_JSON_AST_FORMAT,
		version: PHP_JSON_AST_VERSION,
		program: normalizePhpJsonAst(program),
	};
}

/**
 * Encode a program as compact, deterministic JSON.
 *
 * @param program - Candidate PHP program.
 */
export function encodePhpJsonAst(program: unknown): string {
	return JSON.stringify(createPhpJsonAstEnvelope(program));
}

/**
 * Decode and normalize an already-parsed envelope.
 *
 * @param value - Candidate envelope value.
 */
export function decodePhpJsonAstEnvelope(value: unknown): PhpJsonAstEnvelopeV1 {
	if (!isPlainRecord(value)) {
		throw malformedEnvelope('Expected a plain object.');
	}

	const envelope = requireEnvelopeDataProperties(value);

	if (envelope.format !== PHP_JSON_AST_FORMAT) {
		throw malformedEnvelope(`Expected format "${PHP_JSON_AST_FORMAT}".`);
	}

	if (
		typeof envelope.version !== 'number' ||
		!Number.isSafeInteger(envelope.version) ||
		envelope.version < 1
	) {
		throw malformedEnvelope('Expected version to be a positive integer.');
	}

	if (envelope.version !== PHP_JSON_AST_VERSION) {
		throw new PhpJsonAstCodecError(
			'UNSUPPORTED_VERSION',
			`Unsupported PHP JSON AST version ${envelope.version}; expected ${PHP_JSON_AST_VERSION}.`
		);
	}

	return createPhpJsonAstEnvelope(envelope.program);
}

/**
 * Parse serialized JSON and return its validated canonical envelope.
 *
 * @param serialized - Serialized envelope.
 */
export function parsePhpJsonAstEnvelope(
	serialized: string
): PhpJsonAstEnvelopeV1 {
	if (typeof serialized !== 'string') {
		throw new PhpJsonAstCodecError(
			'INVALID_JSON',
			'PHP JSON AST input must be a string.'
		);
	}

	let value: unknown;
	try {
		value = JSON.parse(serialized) as unknown;
	} catch {
		throw new PhpJsonAstCodecError(
			'INVALID_JSON',
			'PHP JSON AST input is not valid JSON.'
		);
	}

	return decodePhpJsonAstEnvelope(value);
}

/**
 * Parse serialized JSON and return only its normalized PHP program.
 *
 * @param serialized - Serialized envelope.
 */
export function decodePhpJsonAst(serialized: string): PhpProgram {
	return parsePhpJsonAstEnvelope(serialized).program;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function requireEnvelopeDataProperties(
	value: Record<string, unknown>
): Record<(typeof ENVELOPE_KEYS)[number], unknown> {
	const ownKeys = Reflect.ownKeys(value);
	if (
		ownKeys.length !== ENVELOPE_KEYS.length ||
		ownKeys.some(
			(key) =>
				typeof key !== 'string' ||
				!ENVELOPE_KEYS.includes(key as (typeof ENVELOPE_KEYS)[number])
		)
	) {
		throw malformedEnvelope(
			`Expected exactly these fields: ${ENVELOPE_KEYS.join(', ')}.`
		);
	}

	for (const key of ENVELOPE_KEYS) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			!descriptor ||
			!descriptor.enumerable ||
			!Object.prototype.hasOwnProperty.call(descriptor, 'value')
		) {
			throw malformedEnvelope(
				'Envelope fields must be enumerable data properties.'
			);
		}
	}

	return value as Record<(typeof ENVELOPE_KEYS)[number], unknown>;
}

function malformedEnvelope(reason: string): PhpJsonAstCodecError {
	return new PhpJsonAstCodecError(
		'MALFORMED_ENVELOPE',
		`Malformed PHP JSON AST envelope: ${reason}`
	);
}
