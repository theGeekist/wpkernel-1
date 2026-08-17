import {
	buildExpressionStatement,
	buildForeach,
	buildIfStatement,
	buildNode,
	buildReturn,
	type PhpStmt,
	type PhpStmtElse,
	type PhpStmtElseIf,
} from '../nodes';
import { PhpAuthoringError } from './errors';
import { readDenseArrayEntries, readOwnProperty } from './properties';
import {
	isPhpVariableValue,
	variable,
	type PhpVariableValue,
} from './references';
import { renderPhpValue, type PhpAuthoringValue } from './values';

const statementDescriptors = new WeakSet<object>();

export interface PhpStatementValue {
	readonly kind: 'statement';
	readonly statement: PhpStmt;
}

export interface PhpConditionalBranch {
	readonly condition: PhpAuthoringValue;
	readonly statements: readonly PhpStatementValue[];
}

export interface PhpIfStatementOptions extends PhpConditionalBranch {
	readonly elseIf?: readonly PhpConditionalBranch[];
	readonly else?: readonly PhpStatementValue[];
}

export interface PhpForeachStatementOptions {
	readonly iterable: PhpAuthoringValue;
	readonly value: string | PhpVariableValue;
	readonly key?: string | PhpVariableValue | null;
	readonly byReference?: boolean;
	readonly statements: readonly PhpStatementValue[];
}

/**
 * Wrap an authored expression as a PHP expression statement.
 *
 * @param value - Authored expression-compatible value.
 */
export function expressionStatement(
	value: PhpAuthoringValue
): PhpStatementValue {
	return statement(buildExpressionStatement(renderPhpValue(value)));
}

/**
 * Author a PHP return statement. No argument emits `return;`; passing null
 * emits `return null;`.
 *
 * @param values - Zero values for a bare return, or one authored value.
 */
export function returnStatement(
	...values: [] | [PhpAuthoringValue]
): PhpStatementValue {
	if (values.length > 1) {
		throw invalidStatement(
			'$return',
			'Return statements accept at most one value.'
		);
	}
	return statement(
		buildReturn(values.length === 0 ? null : renderPhpValue(values[0]!))
	);
}

/**
 * Author an if/elseif/else statement from bounded statement descriptors.
 *
 * @param options - Conditional branches.
 */
export function ifStatement(options: PhpIfStatementOptions): PhpStatementValue {
	const branch = readBranch(options, '$if');
	const elseIfs = readOptionalStatementOption(options, 'elseIf', '$if');
	const elseIfBranches =
		elseIfs === undefined ? [] : readStatementArray(elseIfs, '$if.elseIf');
	const renderedElseIfs = elseIfBranches.map((elseIf, index) => {
		const nestedBranch = readBranch(elseIf, `$if.elseIf[${index}]`);
		return buildNode<PhpStmtElseIf>('Stmt_ElseIf', {
			cond: renderPhpValue(nestedBranch.condition),
			stmts: renderPhpStatements(nestedBranch.statements),
		});
	});
	const elseStatements = readOptionalStatementOption(options, 'else', '$if');
	const elseBranch =
		elseStatements === undefined
			? null
			: buildNode<PhpStmtElse>('Stmt_Else', {
					stmts: renderPhpStatements(
						elseStatements as readonly PhpStatementValue[]
					),
				});

	return statement(
		buildIfStatement(
			renderPhpValue(branch.condition),
			renderPhpStatements(branch.statements),
			{ elseifs: renderedElseIfs, elseBranch }
		)
	);
}

/**
 * Author a foreach loop over an authored value.
 *
 * @param options - Iterable, loop variables, and bounded body.
 */
export function foreachStatement(
	options: PhpForeachStatementOptions
): PhpStatementValue {
	assertStatementOptions(options, '$foreach');
	const iterable = requireStatementOption(options, 'iterable', '$foreach');
	const value = requireStatementOption(options, 'value', '$foreach');
	const key = readOptionalStatementOption(options, 'key', '$foreach');
	const byReference = readOptionalStatementOption(
		options,
		'byReference',
		'$foreach'
	);
	const statements = requireStatementOption(
		options,
		'statements',
		'$foreach'
	);
	const valueVariable = normalizeLoopVariable(
		value as string | PhpVariableValue,
		'$foreach.value'
	);
	const keyVariable =
		key === undefined || key === null
			? null
			: normalizeLoopVariable(
					key as string | PhpVariableValue,
					'$foreach.key'
				);

	return statement(
		buildForeach(renderPhpValue(iterable as PhpAuthoringValue), {
			valueVar: renderPhpValue(valueVariable),
			keyVar: keyVariable ? renderPhpValue(keyVariable) : null,
			byRef: (byReference as boolean | undefined) ?? false,
			stmts: renderPhpStatements(
				statements as readonly PhpStatementValue[]
			),
		})
	);
}

/**
 * Lower one bounded statement descriptor to raw PHP AST.
 *
 * @param value - Statement created by this authoring layer.
 */
export function renderPhpStatement(value: PhpStatementValue): PhpStmt {
	if (!isPhpStatementValue(value)) {
		throw invalidStatement(
			'$statement',
			'Expected a statement created by an authoring statement helper.'
		);
	}
	return value.statement;
}

/**
 * Lower bounded statement descriptors to raw PHP AST.
 *
 * @param values - Statements created by this authoring layer.
 */
export function renderPhpStatements(
	values: readonly PhpStatementValue[]
): PhpStmt[] {
	const statementValues = readStatementArray(values, '$statements');
	return statementValues.map((value, index) => {
		if (!isPhpStatementValue(value)) {
			throw invalidStatement(
				`$statements[${index}]`,
				'Raw or malformed statement input is not accepted.'
			);
		}
		return value.statement;
	});
}

function readStatementArray(value: unknown, path: string): unknown[] {
	return readDenseArrayEntries(value, path, (errorPath, message) =>
		invalidStatement(errorPath, message)
	);
}

function statement(value: PhpStmt): PhpStatementValue {
	const descriptor = Object.freeze({
		kind: 'statement',
		statement: value,
	});
	statementDescriptors.add(descriptor);
	return descriptor;
}

function isPhpStatementValue(value: unknown): value is PhpStatementValue {
	return (
		value !== null &&
		typeof value === 'object' &&
		statementDescriptors.has(value)
	);
}

function readBranch(value: unknown, path: string): PhpConditionalBranch {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw invalidStatement(path, 'Conditional branch must be a record.');
	}
	const condition = requireStatementOption(value, 'condition', path);
	const statements = requireStatementOption(value, 'statements', path);
	renderPhpStatements(statements as readonly PhpStatementValue[]);
	return {
		condition: condition as PhpAuthoringValue,
		statements: statements as readonly PhpStatementValue[],
	};
}

function assertStatementOptions(
	value: unknown,
	path: string
): asserts value is object {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw invalidStatement(path, 'Statement options must be a record.');
	}
}

function requireStatementOption(
	value: object,
	key: string,
	path: string
): unknown {
	const option = readOwnProperty(value, key);
	if (option.kind !== 'data') {
		throw invalidStatement(
			`${path}.${key}`,
			'Statement options must use own data properties.'
		);
	}
	return option.value;
}

function readOptionalStatementOption(
	value: object,
	key: string,
	path: string
): unknown | undefined {
	const option = readOwnProperty(value, key);
	if (option.kind === 'accessor') {
		throw invalidStatement(
			`${path}.${key}`,
			'Statement options must use own data properties, not accessors.'
		);
	}
	return option.kind === 'data' ? option.value : undefined;
}

function normalizeLoopVariable(
	value: string | PhpVariableValue,
	path: string
): PhpVariableValue {
	if (typeof value === 'string') {
		return variable(value);
	}
	if (!isPhpVariableValue(value)) {
		throw invalidStatement(
			path,
			'Loop variables must be simple variable references.'
		);
	}
	return value;
}

function invalidStatement(path: string, message: string): PhpAuthoringError {
	return new PhpAuthoringError({
		code: 'INVALID_STATEMENT',
		path,
		message,
		hint: 'Compose statements with the bounded authoring helpers.',
	});
}
