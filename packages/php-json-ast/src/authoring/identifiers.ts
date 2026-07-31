import { PhpAuthoringError } from './errors';

export interface NormalizedPhpCallableName {
	readonly parts: readonly string[];
	readonly fullyQualified: boolean;
}

/**
 * Validate and split a simple or namespace-qualified PHP callable name.
 *
 * @param name - Callable name, optionally beginning with `\\`.
 */
export function normalizePhpCallableName(
	name: string
): NormalizedPhpCallableName {
	const trimmed = requireStringIdentifier(name, 'function');
	const fullyQualified = trimmed.startsWith('\\');
	const body = fullyQualified ? trimmed.slice(1) : trimmed;
	const parts = body.split('\\');

	if (body.length === 0 || parts.some((part) => !isPhpIdentifier(part))) {
		throw invalidIdentifier(
			name,
			'function',
			'Use a simple name or namespace segments separated by one backslash.'
		);
	}

	return {
		parts,
		fullyQualified,
	};
}

/**
 * Validate a simple PHP method identifier.
 *
 * @param name - Method name without call syntax.
 */
export function normalizePhpMethodName(name: string): string {
	const trimmed = requireStringIdentifier(name, 'method');
	if (!isPhpIdentifier(trimmed)) {
		throw invalidIdentifier(
			name,
			'method',
			'Dynamic method names require an explicitly authored expression.'
		);
	}
	return trimmed;
}

function requireStringIdentifier(
	value: string,
	kind: 'function' | 'method'
): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw invalidIdentifier(
			String(value),
			kind,
			`${capitalize(kind)} name must be a non-empty string.`
		);
	}
	return value.trim();
}

function isPhpIdentifier(value: string): boolean {
	return /^[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*$/u.test(value);
}

function invalidIdentifier(
	value: string,
	kind: 'function' | 'method',
	hint: string
): PhpAuthoringError {
	return new PhpAuthoringError({
		code: 'INVALID_IDENTIFIER',
		path: `$${kind}`,
		message: `Invalid PHP ${kind} identifier ${JSON.stringify(value)}`,
		hint,
	});
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
