import {
	buildArray,
	buildArrayItem,
	buildNull,
	buildScalarBool,
	buildScalarFloat,
	buildScalarInt,
	buildScalarString,
	buildVariable,
	type PhpExpr,
} from '../nodes';
import { PhpAuthoringError } from './errors';
import { isPhpVariableValue, type PhpVariableValue } from './references';

const expressionDescriptorBrand: unique symbol = Symbol(
	'php-authoring-expression'
);

export interface PhpExpressionValue {
	readonly kind: 'expression';
	readonly expr: PhpExpr;
	readonly [expressionDescriptorBrand]: true;
}

export interface PhpValueRecord {
	readonly [key: string]: PhpAuthoringValue;
}

export type PhpAuthoringValue =
	| string
	| number
	| boolean
	| null
	| PhpVariableValue
	| PhpExpressionValue
	| readonly PhpAuthoringValue[]
	| PhpValueRecord;

/**
 * Mark an already-authored expression for identity-preserving reuse.
 *
 * @param expr - Existing PHP expression AST.
 */
export function expression(expr: PhpExpr): PhpExpressionValue {
	assertPhpExpression(expr);
	return Object.freeze({
		kind: 'expression',
		expr,
		[expressionDescriptorBrand]: true as const,
	});
}

/**
 * Lower a framework-neutral value into PHP expression AST.
 *
 * @param value - Structured value or explicit reference descriptor.
 */
export function renderPhpValue(value: PhpAuthoringValue): PhpExpr {
	return renderValue(value, '$', new Set<object>());
}

function renderValue(
	value: unknown,
	path: string,
	ancestors: Set<object>
): PhpExpr {
	if (isPhpVariableValue(value)) {
		return buildVariable(value.name);
	}
	if (isPhpExpressionValue(value)) {
		return value.expr;
	}
	if (typeof value === 'string') {
		return buildScalarString(value);
	}
	if (typeof value === 'number') {
		return renderNumber(value, path);
	}
	if (typeof value === 'boolean') {
		return buildScalarBool(value);
	}
	if (value === null) {
		return buildNull();
	}
	if (Array.isArray(value)) {
		return renderArray(value, path, ancestors);
	}
	if (typeof value === 'object') {
		return renderRecord(value, path, ancestors);
	}

	throw unsupportedValue(value, path);
}

function renderNumber(value: number, path: string): PhpExpr {
	if (!Number.isFinite(value)) {
		throw new PhpAuthoringError({
			code: 'NON_FINITE_NUMBER',
			path,
			message: 'PHP values require a finite number',
			hint: 'Use null, a string, or an explicitly authored expression.',
		});
	}

	if (Number.isInteger(value)) {
		if (!Number.isSafeInteger(value)) {
			throw new PhpAuthoringError({
				code: 'UNSAFE_INTEGER',
				path,
				message: 'PHP integer value is outside JavaScript’s safe range',
				hint: 'Use a string or an explicitly authored numeric expression.',
			});
		}
		return buildScalarInt(Object.is(value, -0) ? 0 : value);
	}

	return buildScalarFloat(value);
}

function renderArray(
	value: readonly unknown[],
	path: string,
	ancestors: Set<object>
): PhpExpr {
	return withAncestor(value, path, ancestors, () => {
		const entries = requireDenseArrayEntries(value, path);
		return buildArray(
			entries.map((entry, index) =>
				buildArrayItem(
					renderValue(entry, `${path}[${index}]`, ancestors)
				)
			)
		);
	});
}

function renderRecord(
	value: object,
	path: string,
	ancestors: Set<object>
): PhpExpr {
	if (!isPlainRecord(value)) {
		throw new PhpAuthoringError({
			code: 'AMBIGUOUS_VALUE',
			path,
			message: 'Only plain records can be authored as PHP arrays',
			hint: 'Convert the value to a plain record or use expression(...).',
		});
	}
	if (looksLikeRawAst(value)) {
		throw new PhpAuthoringError({
			code: 'AMBIGUOUS_VALUE',
			path,
			message: 'Raw AST objects are ambiguous as structured PHP values',
			hint: 'Wrap an existing PhpExpr with expression(...).',
		});
	}

	return withAncestor(value, path, ancestors, () => {
		assertEnumerableDataProperties(value, path);
		return buildArray(
			Object.entries(value).map(([key, entry]) =>
				buildArrayItem(
					renderValue(entry, propertyPath(path, key), ancestors),
					{ key: buildScalarString(key) }
				)
			)
		);
	});
}

function assertPhpExpression(value: unknown): asserts value is PhpExpr {
	if (!isPlainRecord(value)) {
		throw invalidExpression('Expected a PHP expression AST object');
	}

	const { nodeType, attributes } = value;
	if (
		typeof nodeType !== 'string' ||
		(!nodeType.startsWith('Expr_') && !nodeType.startsWith('Scalar_'))
	) {
		throw invalidExpression(
			'Expected an expression nodeType such as Expr_* or Scalar_*'
		);
	}
	if (!isPlainRecord(attributes)) {
		throw invalidExpression(
			'Expected expression attributes to be a record'
		);
	}
}

export function isPhpExpressionValue(
	value: unknown
): value is PhpExpressionValue {
	return (
		Boolean(value) &&
		typeof value === 'object' &&
		(value as Partial<PhpExpressionValue>)[expressionDescriptorBrand] ===
			true
	);
}

function requireDenseArrayEntries(
	value: readonly unknown[],
	path: string
): unknown[] {
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
			throw new PhpAuthoringError({
				code: 'AMBIGUOUS_VALUE',
				path: `${path}[${index}]`,
				message:
					'Sparse arrays and accessor entries cannot be authored deterministically',
				hint: 'Materialize every entry explicitly, usually with null.',
			});
		}
		entries.push(descriptor.value);
	}

	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === 'symbol' || !allowedKeys.has(key)) {
			throw new PhpAuthoringError({
				code: 'AMBIGUOUS_VALUE',
				path,
				message: 'Arrays with custom properties are not supported',
				hint: 'Use a plain record for keyed values.',
			});
		}
	}

	return entries;
}

function assertEnumerableDataProperties(
	value: Record<string, unknown>,
	path: string
): void {
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key === 'symbol') {
			throw new PhpAuthoringError({
				code: 'AMBIGUOUS_VALUE',
				path,
				message: 'Symbol-keyed record values are not supported',
				hint: 'Use string keys only.',
			});
		}

		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			!descriptor ||
			!descriptor.enumerable ||
			!Object.prototype.hasOwnProperty.call(descriptor, 'value')
		) {
			throw new PhpAuthoringError({
				code: 'AMBIGUOUS_VALUE',
				path: propertyPath(path, key),
				message: 'Record entries must be enumerable data properties',
				hint: 'Evaluate accessors before authoring the value.',
			});
		}
	}
}

function withAncestor<T>(
	value: object,
	path: string,
	ancestors: Set<object>,
	operation: () => T
): T {
	if (ancestors.has(value)) {
		throw new PhpAuthoringError({
			code: 'CYCLIC_VALUE',
			path,
			message: 'Cyclic values cannot be represented as PHP literals',
			hint: 'Break the cycle or use an explicitly authored reference.',
		});
	}

	ancestors.add(value);
	try {
		return operation();
	} finally {
		ancestors.delete(value);
	}
}

function looksLikeRawAst(value: Record<string, unknown>): boolean {
	return Object.prototype.hasOwnProperty.call(value, 'nodeType');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function unsupportedValue(value: unknown, path: string): PhpAuthoringError {
	return new PhpAuthoringError({
		code: 'UNSUPPORTED_VALUE',
		path,
		message: `Unsupported JavaScript value type "${typeof value}"`,
		hint: 'Supported values are strings, finite numbers, booleans, null, arrays, records, variables, and authored expressions.',
	});
}

function invalidExpression(message: string): PhpAuthoringError {
	return new PhpAuthoringError({
		code: 'INVALID_EXPRESSION',
		path: '$expression',
		message,
		hint: 'Pass an expression created by the PHP AST builders.',
	});
}

function propertyPath(parent: string, key: string): string {
	return /^[A-Za-z_$][\w$]*$/u.test(key)
		? `${parent}.${key}`
		: `${parent}[${JSON.stringify(key)}]`;
}
