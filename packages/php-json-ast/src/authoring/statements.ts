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
import {
	isPhpVariableValue,
	variable,
	type PhpVariableValue,
} from './references';
import { renderPhpValue, type PhpAuthoringValue } from './values';

const statementDescriptorBrand: unique symbol = Symbol(
	'php-authoring-statement'
);

export interface PhpStatementValue {
	readonly kind: 'statement';
	readonly statement: PhpStmt;
	readonly [statementDescriptorBrand]: true;
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
	assertBranch(options, '$if');
	const elseIfs = (options.elseIf ?? []).map((branch, index) => {
		assertBranch(branch, `$if.elseIf[${index}]`);
		return buildNode<PhpStmtElseIf>('Stmt_ElseIf', {
			cond: renderPhpValue(branch.condition),
			stmts: renderPhpStatements(branch.statements),
		});
	});
	const elseBranch =
		options.else === undefined
			? null
			: buildNode<PhpStmtElse>('Stmt_Else', {
					stmts: renderPhpStatements(options.else),
				});

	return statement(
		buildIfStatement(
			renderPhpValue(options.condition),
			renderPhpStatements(options.statements),
			{ elseifs: elseIfs, elseBranch }
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
	const valueVariable = normalizeLoopVariable(
		options.value,
		'$foreach.value'
	);
	const keyVariable =
		options.key === undefined || options.key === null
			? null
			: normalizeLoopVariable(options.key, '$foreach.key');

	return statement(
		buildForeach(renderPhpValue(options.iterable), {
			valueVar: renderPhpValue(valueVariable),
			keyVar: keyVariable ? renderPhpValue(keyVariable) : null,
			byRef: options.byReference ?? false,
			stmts: renderPhpStatements(options.statements),
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
	if (!Array.isArray(values)) {
		throw invalidStatement('$statements', 'Expected a statement array.');
	}
	return values.map((value, index) => {
		if (!isPhpStatementValue(value)) {
			throw invalidStatement(
				`$statements[${index}]`,
				'Raw or malformed statement input is not accepted.'
			);
		}
		return value.statement;
	});
}

function statement(value: PhpStmt): PhpStatementValue {
	return Object.freeze({
		kind: 'statement',
		statement: value,
		[statementDescriptorBrand]: true as const,
	});
}

function isPhpStatementValue(value: unknown): value is PhpStatementValue {
	return (
		Boolean(value) &&
		typeof value === 'object' &&
		(value as Partial<PhpStatementValue>)[statementDescriptorBrand] === true
	);
}

function assertBranch(
	value: PhpConditionalBranch,
	path: string
): asserts value is PhpConditionalBranch {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw invalidStatement(path, 'Conditional branch must be a record.');
	}
	if (!Object.prototype.hasOwnProperty.call(value, 'condition')) {
		throw invalidStatement(path, 'Conditional branch requires condition.');
	}
	renderPhpStatements(value.statements);
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
