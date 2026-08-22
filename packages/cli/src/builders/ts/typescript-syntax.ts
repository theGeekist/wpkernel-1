const IDENTIFIER_PROPERTY_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

/**
 * Render an arbitrary value as a single-quoted TypeScript string literal.
 *
 * @param value - Raw string value.
 */
export function typeScriptStringLiteral(value: string): string {
	const escaped = value.replace(
		/[\u0000-\u001f\\'\u2028\u2029]/gu,
		(character) => {
			switch (character) {
				case '\b':
					return '\\b';
				case '\t':
					return '\\t';
				case '\n':
					return '\\n';
				case '\f':
					return '\\f';
				case '\r':
					return '\\r';
				case "'":
					return "\\'";
				case '\\':
					return '\\\\';
				case '\u2028':
					return '\\u2028';
				case '\u2029':
					return '\\u2029';
				default:
					return `\\x${character.charCodeAt(0).toString(16).padStart(2, '0')}`;
			}
		}
	);
	return `'${escaped}'`;
}

/**
 * Render an arbitrary record key as a TypeScript property declaration name.
 *
 * @param value - Authoritative record key.
 */
export function typeScriptPropertyName(value: string): string {
	return IDENTIFIER_PROPERTY_NAME.test(value) && value !== '__proto__'
		? value
		: typeScriptStringLiteral(value);
}

/**
 * Render an arbitrary record key inside an object literal.
 *
 * @param value - Authoritative record key.
 */
export function typeScriptObjectPropertyName(value: string): string {
	return value === '__proto__'
		? `[${typeScriptStringLiteral(value)}]`
		: typeScriptPropertyName(value);
}

/**
 * Render safe access to an arbitrary record key.
 *
 * @param object - Generated object expression.
 * @param key    - Authoritative record key.
 */
export function typeScriptPropertyAccess(object: string, key: string): string {
	return IDENTIFIER_PROPERTY_NAME.test(key) && key !== '__proto__'
		? `${object}.${key}`
		: `${object}[${typeScriptStringLiteral(key)}]`;
}

/**
 * Render an own data-property assignment without invoking __proto__ setters.
 *
 * @param object - Generated object expression.
 * @param key    - Authoritative record key.
 * @param value  - Generated value expression.
 */
export function typeScriptDataPropertyAssignment(
	object: string,
	key: string,
	value: string
): string {
	if (key === '__proto__') {
		return `Object.defineProperty(${object}, ${typeScriptStringLiteral(key)}, { configurable: true, enumerable: true, value: ${value}, writable: true });`;
	}
	return `${typeScriptPropertyAccess(object, key)} = ${value};`;
}
