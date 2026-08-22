import {
	typeScriptDataPropertyAssignment,
	typeScriptObjectPropertyName,
	typeScriptPropertyAccess,
	typeScriptPropertyName,
	typeScriptStringLiteral,
} from '../typescript-syntax';

describe('TypeScript syntax rendering', () => {
	it.each([
		['plain', "'plain'"],
		["editor's note", "'editor\\'s note'"],
		['path\\segment', "'path\\\\segment'"],
		['line\nbreak', "'line\\nbreak'"],
		['carriage\rreturn', "'carriage\\rreturn'"],
		['tab\tstop', "'tab\\tstop'"],
		['back\bspace', "'back\\bspace'"],
		['form\ffeed', "'form\\ffeed'"],
		['null\0byte', "'null\\x00byte'"],
		['unit\u001fseparator', "'unit\\x1fseparator'"],
		['line\u2028separator', "'line\\u2028separator'"],
		['paragraph\u2029separator', "'paragraph\\u2029separator'"],
	])('renders %j as a safe string literal', (value, expected) => {
		expect(typeScriptStringLiteral(value)).toBe(expected);
	});

	it('renders declaration and object property names safely', () => {
		expect(typeScriptPropertyName('validName')).toBe('validName');
		expect(typeScriptPropertyName('123')).toBe("'123'");
		expect(typeScriptPropertyName('punctuation.key')).toBe(
			"'punctuation.key'"
		);
		expect(typeScriptPropertyName('__proto__')).toBe("'__proto__'");
		expect(typeScriptObjectPropertyName('__proto__')).toBe("['__proto__']");
	});

	it('renders safe property access without losing authoritative keys', () => {
		expect(typeScriptPropertyAccess('item', 'validName')).toBe(
			'item.validName'
		);
		expect(typeScriptPropertyAccess('item', '123')).toBe("item['123']");
		expect(typeScriptPropertyAccess('item', 'punctuation.key')).toBe(
			"item['punctuation.key']"
		);
		expect(typeScriptPropertyAccess('item', '__proto__')).toBe(
			"item['__proto__']"
		);
	});

	it('uses an own data property for __proto__ assignment', () => {
		expect(
			typeScriptDataPropertyAssignment('target', 'safe', 'value')
		).toBe('target.safe = value;');
		expect(
			typeScriptDataPropertyAssignment('target', '__proto__', 'value')
		).toBe(
			"Object.defineProperty(target, '__proto__', { configurable: true, enumerable: true, value: value, writable: true });"
		);
	});
});
