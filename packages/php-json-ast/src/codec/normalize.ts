import type { PhpProgram, PhpStmt } from '../nodes';
import { PhpJsonAstCodecError } from './protocol';

/**
 * PhpParser source positions are intentionally absent from canonical AST.
 * They describe one source rendering and are not semantic program data.
 */
export const PHP_JSON_AST_POSITION_ATTRIBUTE_KEYS = Object.freeze([
	'startLine',
	'endLine',
	'startFilePos',
	'endFilePos',
	'startTokenPos',
	'endTokenPos',
] as const);

/**
 * PhpParser serializes comment positions directly on comment objects.
 */
export const PHP_JSON_AST_COMMENT_POSITION_KEYS = Object.freeze([
	'line',
	'endLine',
	'filePos',
	'endFilePos',
	'tokenPos',
	'endTokenPos',
] as const);

const positionAttributeKeys = new Set<string>(
	PHP_JSON_AST_POSITION_ATTRIBUTE_KEYS
);
const commentPositionKeys = new Set<string>(PHP_JSON_AST_COMMENT_POSITION_KEYS);

/**
 * Produce the version-one canonical AST representation.
 *
 * Rules:
 * - statement and array order is preserved;
 * - object keys have deterministic order;
 * - every AST node has an attributes object;
 * - non-position attributes are preserved;
 * - comments and comment order are preserved, while comment positions are removed;
 * - undefined, non-finite numbers, non-plain objects, and cycles are rejected.
 *
 * @param program - Candidate PHP program.
 */
export function normalizePhpJsonAst(program: unknown): PhpProgram {
	if (!Array.isArray(program)) {
		throw invalidProgram('$', 'Expected a PHP program array.');
	}

	const ancestors = new Set<object>();
	return normalizeArray(program, '$', ancestors, (statement, entryPath) =>
		normalizeStatement(statement, entryPath, ancestors)
	);
}

function normalizeStatement(
	value: unknown,
	path: string,
	ancestors: Set<object>
): PhpStmt {
	const record = requirePlainRecord(value, path);
	const nodeType = requireNodeType(record, path);
	if (!nodeType.startsWith('Stmt_')) {
		throw invalidProgram(
			path,
			`Expected a statement node, received "${nodeType}".`
		);
	}

	return normalizeNode(record, path, ancestors) as unknown as PhpStmt;
}

function normalizeValue(
	value: unknown,
	path: string,
	ancestors: Set<object>
): unknown {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			throw nonJsonValue(path, 'Expected a finite number.');
		}
		return Object.is(value, -0) ? 0 : value;
	}

	if (Array.isArray(value)) {
		return normalizeArray(value, path, ancestors, (entry, entryPath) =>
			normalizeValue(entry, entryPath, ancestors)
		);
	}

	if (typeof value !== 'object') {
		throw nonJsonValue(path, `Unsupported value type "${typeof value}".`);
	}

	const record = requirePlainRecord(value, path);
	if (Object.prototype.hasOwnProperty.call(record, 'nodeType')) {
		return normalizeNode(record, path, ancestors);
	}

	return normalizeRecord(record, path, ancestors);
}

function normalizeNode(
	record: Record<string, unknown>,
	path: string,
	ancestors: Set<object>
): Record<string, unknown> {
	return withAncestor(record, path, ancestors, () => {
		const nodeType = requireNodeType(record, path);
		if (nodeType.startsWith('Comment')) {
			return normalizeComment(record, path, ancestors);
		}

		const normalized: Record<string, unknown> = {
			nodeType,
			attributes: Object.prototype.hasOwnProperty.call(
				record,
				'attributes'
			)
				? normalizeAttributes(
						record.attributes,
						`${path}.attributes`,
						ancestors
					)
				: {},
		};

		for (const key of sortedKeys(record)) {
			if (key === 'nodeType' || key === 'attributes') {
				continue;
			}
			defineNormalizedProperty(
				normalized,
				key,
				normalizeValue(record[key], propertyPath(path, key), ancestors)
			);
		}

		return normalized;
	});
}

function normalizeAttributes(
	value: unknown,
	path: string,
	ancestors: Set<object>
): Record<string, unknown> {
	if (value === undefined) {
		throw nonJsonValue(path, 'Undefined is not supported.');
	}

	const attributes = requirePlainRecord(value, path);
	return withAncestor(attributes, path, ancestors, () => {
		const normalized: Record<string, unknown> = {};
		for (const key of sortedKeys(attributes)) {
			if (positionAttributeKeys.has(key)) {
				continue;
			}

			if (key === 'comments') {
				normalized.comments = normalizeComments(
					attributes.comments,
					`${path}.comments`,
					ancestors
				);
				continue;
			}

			defineNormalizedProperty(
				normalized,
				key,
				normalizeValue(
					attributes[key],
					propertyPath(path, key),
					ancestors
				)
			);
		}
		return normalized;
	});
}

function normalizeComments(
	value: unknown,
	path: string,
	ancestors: Set<object>
): ReadonlyArray<Record<string, unknown>> {
	if (!Array.isArray(value)) {
		throw invalidProgram(path, 'Expected comments to be an array.');
	}

	return normalizeArray(value, path, ancestors, (comment, commentPath) => {
		const record = requirePlainRecord(comment, commentPath);
		const nodeType = requireNodeType(record, commentPath);
		if (!nodeType.startsWith('Comment')) {
			throw invalidProgram(
				commentPath,
				`Expected a comment node, received "${nodeType}".`
			);
		}
		return normalizeNode(record, commentPath, ancestors);
	});
}

function normalizeComment(
	record: Record<string, unknown>,
	path: string,
	ancestors: Set<object>
): Record<string, unknown> {
	const nodeType = requireNodeType(record, path);
	if (typeof record.text !== 'string') {
		throw invalidProgram(`${path}.text`, 'Expected comment text.');
	}

	const normalized: Record<string, unknown> = {
		nodeType,
		text: record.text,
	};
	for (const key of sortedKeys(record)) {
		if (
			key === 'nodeType' ||
			key === 'text' ||
			commentPositionKeys.has(key)
		) {
			continue;
		}
		defineNormalizedProperty(
			normalized,
			key,
			normalizeValue(record[key], propertyPath(path, key), ancestors)
		);
	}
	return normalized;
}

function normalizeRecord(
	record: Record<string, unknown>,
	path: string,
	ancestors: Set<object>
): Record<string, unknown> {
	return withAncestor(record, path, ancestors, () => {
		const normalized: Record<string, unknown> = {};
		for (const key of sortedKeys(record)) {
			defineNormalizedProperty(
				normalized,
				key,
				normalizeValue(record[key], propertyPath(path, key), ancestors)
			);
		}
		return normalized;
	});
}

function defineNormalizedProperty(
	target: Record<string, unknown>,
	key: string,
	value: unknown
): void {
	Object.defineProperty(target, key, {
		configurable: true,
		enumerable: true,
		value,
		writable: true,
	});
}

function normalizeArray<T>(
	value: unknown[],
	path: string,
	ancestors: Set<object>,
	normalizeEntry: (entry: unknown, entryPath: string) => T
): T[] {
	return withAncestor(value, path, ancestors, () => {
		const entries = requireArrayDataProperties(value, path);
		const normalized: T[] = [];
		for (let index = 0; index < entries.length; index += 1) {
			normalized.push(
				normalizeEntry(entries[index], `${path}[${index}]`)
			);
		}

		return normalized;
	});
}

function requireArrayDataProperties(value: unknown[], path: string): unknown[] {
	const entries: unknown[] = [];
	const allowedKeys = new Set<string>(['length']);

	for (let index = 0; index < value.length; index += 1) {
		const key = String(index);
		allowedKeys.add(key);
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			!descriptor ||
			!descriptor.enumerable ||
			!Object.prototype.hasOwnProperty.call(descriptor, 'value')
		) {
			throw nonJsonValue(
				`${path}[${index}]`,
				'Sparse arrays and accessor entries are not supported.'
			);
		}
		entries.push(descriptor.value);
	}

	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === 'symbol') {
			throw nonJsonValue(
				path,
				'Symbol-keyed properties are not supported.'
			);
		}
		if (!allowedKeys.has(key)) {
			throw nonJsonValue(
				propertyPath(path, key),
				'Array properties other than indexed entries are not supported.'
			);
		}
	}

	return entries;
}

function requirePlainRecord(
	value: unknown,
	path: string
): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw invalidProgram(path, 'Expected a plain object.');
	}

	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		throw nonJsonValue(path, 'Expected a plain JSON object.');
	}

	assertEnumerableDataProperties(value, path);
	return value as Record<string, unknown>;
}

function assertEnumerableDataProperties(value: object, path: string): void {
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === 'symbol') {
			throw nonJsonValue(
				path,
				'Symbol-keyed properties are not supported.'
			);
		}

		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			!descriptor ||
			!descriptor.enumerable ||
			!Object.prototype.hasOwnProperty.call(descriptor, 'value')
		) {
			throw nonJsonValue(
				propertyPath(path, key),
				'Only enumerable data properties are supported.'
			);
		}
	}
}

function requireNodeType(
	record: Record<string, unknown>,
	path: string
): string {
	const { nodeType } = record;
	if (typeof nodeType !== 'string' || nodeType.trim().length === 0) {
		throw invalidProgram(
			`${path}.nodeType`,
			'Expected a non-empty string.'
		);
	}
	return nodeType;
}

function withAncestor<T>(
	value: object,
	path: string,
	ancestors: Set<object>,
	operation: () => T
): T {
	if (ancestors.has(value)) {
		throw nonJsonValue(path, 'Cyclic values are not supported.');
	}

	ancestors.add(value);
	try {
		return operation();
	} finally {
		ancestors.delete(value);
	}
}

function sortedKeys(record: Record<string, unknown>): string[] {
	return Object.keys(record).sort((left, right) => {
		if (left < right) {
			return -1;
		}
		if (left > right) {
			return 1;
		}
		return 0;
	});
}

function propertyPath(parent: string, key: string): string {
	return /^[A-Za-z_$][\w$]*$/u.test(key)
		? `${parent}.${key}`
		: `${parent}[${JSON.stringify(key)}]`;
}

function invalidProgram(path: string, reason: string): PhpJsonAstCodecError {
	return new PhpJsonAstCodecError(
		'INVALID_PROGRAM',
		`Invalid PHP JSON AST at ${path}: ${reason}`
	);
}

function nonJsonValue(path: string, reason: string): PhpJsonAstCodecError {
	return new PhpJsonAstCodecError(
		'NON_JSON_VALUE',
		`Invalid JSON value at ${path}: ${reason}`
	);
}
