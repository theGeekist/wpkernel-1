import {
	buildArg,
	buildArray,
	buildArrayItem,
	buildAssign,
	buildFullyQualifiedName,
	buildFuncCall,
	buildIdentifier,
	buildMethodCall,
	buildName,
} from '../nodes';
import { PhpAuthoringError } from './errors';
import {
	normalizePhpCallableName,
	normalizePhpMethodName,
} from './identifiers';
import {
	isPhpVariableValue,
	variable,
	type PhpVariableValue,
} from './references';
import {
	expression,
	isPhpExpressionValue,
	renderPhpValue,
	type PhpAuthoringValue,
	type PhpExpressionValue,
} from './values';
import { readDenseArrayEntries, readOwnProperty } from './properties';

export type PhpExpressionInput = PhpAuthoringValue;

export type PhpCallSubject = PhpVariableValue | PhpExpressionValue;

export interface PhpArrayEntry {
	readonly value: PhpExpressionInput;
	readonly key?: PhpExpressionInput;
	readonly byReference?: boolean;
	readonly unpack?: boolean;
}

/**
 * Author a bounded function call with positional value arguments.
 *
 * @param name - Simple, qualified, or fully-qualified callable name.
 * @param args - Positional authored values.
 */
export function functionCall(
	name: string,
	args: readonly PhpExpressionInput[] = []
): PhpExpressionValue {
	const callable = normalizePhpCallableName(name);
	const functionName = callable.fullyQualified
		? buildFullyQualifiedName([...callable.parts])
		: buildName([...callable.parts]);
	const values = readExpressionArray(args, '$function.args');
	return expression(
		buildFuncCall(
			functionName,
			values.map((value) =>
				buildArg(renderPhpValue(value as PhpExpressionInput))
			)
		)
	);
}

/**
 * Author a bounded method call on a variable or authored expression.
 *
 * @param subject - Explicit variable or expression receiver.
 * @param method  - Simple method identifier.
 * @param args    - Positional authored values.
 */
export function methodCall(
	subject: PhpCallSubject,
	method: string,
	args: readonly PhpExpressionInput[] = []
): PhpExpressionValue {
	assertCallSubject(subject);
	const values = readExpressionArray(args, '$method.args');
	return expression(
		buildMethodCall(
			renderPhpValue(subject),
			buildIdentifier(normalizePhpMethodName(method)),
			values.map((value) =>
				buildArg(renderPhpValue(value as PhpExpressionInput))
			)
		)
	);
}

/**
 * Author assignment to a simple PHP variable.
 *
 * @param target - Variable descriptor or simple variable name.
 * @param value  - Authored value assigned to the variable.
 */
export function assignment(
	target: string | PhpVariableValue,
	value: PhpExpressionInput
): PhpExpressionValue {
	const reference =
		typeof target === 'string'
			? variable(target)
			: requireVariableValue(target);
	return expression(
		buildAssign(renderPhpValue(reference), renderPhpValue(value))
	);
}

/**
 * Author an explicit PHP array with optional keys, references, or unpacking.
 *
 * @param entries - Explicit PHP array entries.
 */
export function arrayExpression(
	entries: readonly PhpArrayEntry[]
): PhpExpressionValue {
	const arrayEntries = readExpressionArray(entries, '$array');

	return expression(
		buildArray(
			arrayEntries.map((entry, index) => {
				const options = readArrayEntry(entry as PhpArrayEntry, index);
				return buildArrayItem(renderPhpValue(options.value), {
					key:
						options.key === undefined
							? null
							: renderPhpValue(options.key),
					byRef: options.byReference ?? false,
					unpack: options.unpack ?? false,
				});
			})
		)
	);
}

function readExpressionArray(value: unknown, path: string): unknown[] {
	return readDenseArrayEntries(value, path, (errorPath, message) =>
		ambiguousExpression(errorPath, message)
	);
}

function assertCallSubject(
	subject: PhpCallSubject
): asserts subject is PhpCallSubject {
	if (!isPhpVariableValue(subject) && !isPhpExpressionValue(subject)) {
		throw ambiguousExpression(
			'$method.subject',
			'Method subjects must be created with variable(...) or an expression authoring helper.'
		);
	}
}

function requireVariableValue(value: unknown): PhpVariableValue {
	if (!isPhpVariableValue(value)) {
		throw ambiguousExpression(
			'$assignment.target',
			'Assignment targets must be simple variable references.'
		);
	}
	return value;
}

function readArrayEntry(entry: PhpArrayEntry, index: number): PhpArrayEntry {
	const path = `$array[${index}]`;
	if (!isPlainRecord(entry)) {
		throw ambiguousExpression(path, 'Array entries must be plain records.');
	}
	const keys = Object.keys(entry);
	if (
		!Object.prototype.hasOwnProperty.call(entry, 'value') ||
		keys.some(
			(key) =>
				key !== 'value' &&
				key !== 'key' &&
				key !== 'byReference' &&
				key !== 'unpack'
		)
	) {
		throw ambiguousExpression(
			path,
			'Array entries require value and only support key, byReference, and unpack options.'
		);
	}
	const value = requireArrayEntryOption(entry, 'value', path);
	const key = readArrayEntryOption(entry, 'key', path);
	const byReference = readArrayEntryOption(entry, 'byReference', path);
	const unpack = readArrayEntryOption(entry, 'unpack', path);
	if (byReference && unpack) {
		throw ambiguousExpression(
			path,
			'An array entry cannot be both by-reference and unpacked.'
		);
	}
	if (unpack && key !== undefined) {
		throw ambiguousExpression(
			path,
			'An unpacked array entry cannot declare an explicit key.'
		);
	}
	return {
		value: value as PhpExpressionInput,
		key: key as PhpExpressionInput | undefined,
		byReference: byReference as boolean | undefined,
		unpack: unpack as boolean | undefined,
	};
}

function requireArrayEntryOption(
	entry: Record<string, unknown>,
	key: string,
	path: string
): unknown {
	const option = readOwnProperty(entry, key);
	if (option.kind !== 'data') {
		throw ambiguousExpression(
			path,
			'Array entries must use own data properties for every option.'
		);
	}
	return option.value;
}

function readArrayEntryOption(
	entry: Record<string, unknown>,
	key: string,
	path: string
): unknown | undefined {
	const option = readOwnProperty(entry, key);
	if (option.kind === 'accessor') {
		throw ambiguousExpression(
			path,
			'Array entry options must be own data properties, not accessors.'
		);
	}
	return option.kind === 'data' ? option.value : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function ambiguousExpression(path: string, message: string): PhpAuthoringError {
	return new PhpAuthoringError({
		code: 'AMBIGUOUS_VALUE',
		path,
		message,
		hint: 'Use the bounded authoring descriptors instead of raw AST.',
	});
}
