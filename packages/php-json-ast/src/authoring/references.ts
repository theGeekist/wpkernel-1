import { PhpAuthoringError } from './errors';

const variableDescriptorBrand: unique symbol = Symbol('php-authoring-variable');

export interface NormalizedPhpVariableReference {
	/** Variable name without the leading sigil. */
	readonly raw: string;
	/** Variable name with the leading sigil. */
	readonly display: string;
}

export interface PhpVariableValue {
	readonly kind: 'variable';
	readonly name: string;
	readonly [variableDescriptorBrand]: true;
}

/**
 * Normalize and validate a simple PHP variable reference.
 *
 * Dynamic variables, property access, and array access are deliberately not
 * accepted here; callers must author those as explicit expressions.
 *
 * @param name - Bare name or a name with one leading `$`.
 */
export function normalizePhpVariableReference(
	name: string
): NormalizedPhpVariableReference {
	if (typeof name !== 'string') {
		throw invalidVariable(
			String(name),
			'Variable reference must be a string'
		);
	}

	const trimmed = name.trim();
	if (trimmed.length === 0) {
		throw invalidVariable(name, 'Variable reference must not be empty');
	}

	const raw = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed;
	if (raw.length === 0) {
		throw invalidVariable(
			name,
			'Variable reference requires an identifier'
		);
	}
	if (!isPhpVariableIdentifier(raw)) {
		throw invalidVariable(
			name,
			`"${trimmed}" is not a simple PHP variable reference`
		);
	}

	return {
		raw,
		display: `$${raw}`,
	};
}

/**
 * Describe a PHP variable for use in a structured authored value.
 *
 * @param name - Bare name or a name with one leading `$`.
 */
export function variable(name: string): PhpVariableValue {
	const reference = normalizePhpVariableReference(name);
	return Object.freeze({
		kind: 'variable',
		name: reference.raw,
		[variableDescriptorBrand]: true as const,
	});
}

export function isPhpVariableValue(value: unknown): value is PhpVariableValue {
	return (
		Boolean(value) &&
		typeof value === 'object' &&
		(value as Partial<PhpVariableValue>)[variableDescriptorBrand] === true
	);
}

function isPhpVariableIdentifier(value: string): boolean {
	return /^[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*$/u.test(value);
}

function invalidVariable(name: string, message: string): PhpAuthoringError {
	return new PhpAuthoringError({
		code: 'INVALID_VARIABLE_REFERENCE',
		path: '$variable',
		message,
		hint: `Received ${JSON.stringify(name)}. Use expression(...) for dynamic references.`,
	});
}
