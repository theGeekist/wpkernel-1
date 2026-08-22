import { buildReturn, buildScalarInt } from '../../nodes';
import type { PhpAuthoringError } from '../errors';
import { assignment, functionCall } from '../expressions';
import { variable } from '../references';
import {
	expressionStatement,
	foreachStatement,
	ifStatement,
	renderPhpStatement,
	renderPhpStatements,
	returnStatement,
} from '../statements';

describe('PHP statement authoring', () => {
	it('authors expression and return statements', () => {
		const statements = renderPhpStatements([
			expressionStatement(assignment('result', 5)),
			returnStatement(variable('result')),
			returnStatement(),
		]);

		expect(statements).toMatchObject([
			{
				nodeType: 'Stmt_Expression',
				expr: { nodeType: 'Expr_Assign' },
			},
			{
				nodeType: 'Stmt_Return',
				expr: { nodeType: 'Expr_Variable', name: 'result' },
			},
			{
				nodeType: 'Stmt_Return',
				expr: null,
			},
		]);
	});

	it('distinguishes bare return from returning null', () => {
		expect(renderPhpStatement(returnStatement())).toMatchObject({
			expr: null,
		});
		expect(renderPhpStatement(returnStatement(null))).toMatchObject({
			expr: {
				nodeType: 'Expr_ConstFetch',
				name: { parts: ['null'] },
			},
		});
	});

	it('rejects more than one return value at runtime', () => {
		expect(() =>
			(returnStatement as (...values: unknown[]) => unknown)(1, 2)
		).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_STATEMENT',
				path: '$return',
			})
		);
	});

	it('authors complete if, elseif, and else branches', () => {
		const authored = ifStatement({
			condition: functionCall('is_primary'),
			statements: [returnStatement('primary')],
			elseIf: [
				{
					condition: variable('fallback'),
					statements: [returnStatement('fallback')],
				},
			],
			else: [returnStatement(null)],
		});

		expect(renderPhpStatement(authored)).toMatchObject({
			nodeType: 'Stmt_If',
			cond: { nodeType: 'Expr_FuncCall' },
			stmts: [{ nodeType: 'Stmt_Return' }],
			elseifs: [
				{
					nodeType: 'Stmt_ElseIf',
					cond: { nodeType: 'Expr_Variable', name: 'fallback' },
					stmts: [{ nodeType: 'Stmt_Return' }],
				},
			],
			else: {
				nodeType: 'Stmt_Else',
				stmts: [{ nodeType: 'Stmt_Return' }],
			},
		});
	});

	it('authors foreach with validated key/value variables and body', () => {
		const authored = foreachStatement({
			iterable: variable('items'),
			key: '$key',
			value: variable('$item'),
			byReference: true,
			statements: [
				expressionStatement(
					functionCall('consume', [variable('key'), variable('item')])
				),
			],
		});

		expect(renderPhpStatement(authored)).toMatchObject({
			nodeType: 'Stmt_Foreach',
			expr: { nodeType: 'Expr_Variable', name: 'items' },
			keyVar: { nodeType: 'Expr_Variable', name: 'key' },
			valueVar: { nodeType: 'Expr_Variable', name: 'item' },
			byRef: true,
			stmts: [{ nodeType: 'Stmt_Expression' }],
		});
	});

	it.each([
		['string', 'true'],
		['number', 1],
		['null', null],
		['explicit undefined', undefined],
	])('rejects a %s foreach byReference option', (_label, byReference) => {
		expect(() =>
			foreachStatement({
				iterable: variable('items'),
				value: variable('item'),
				byReference: byReference as never,
				statements: [],
			})
		).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_STATEMENT',
				path: '$foreach.byReference',
			})
		);
	});

	it('rejects raw statements in bounded bodies', () => {
		const raw = buildReturn(buildScalarInt(1));

		expect(() => renderPhpStatements([raw as never])).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_STATEMENT',
				path: '$statements[0]',
			})
		);
		expect(() =>
			ifStatement({
				condition: true,
				statements: [raw as never],
			})
		).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_STATEMENT',
			})
		);
	});

	it('rejects accessor-backed statement options without evaluating them', () => {
		const conditional = accessorOption('statements');
		Object.assign(conditional.value, { condition: true });
		const foreachStatements = accessorOption('statements');
		Object.assign(foreachStatements.value, {
			iterable: variable('items'),
			value: variable('item'),
		});
		const foreachByReference = accessorOption('byReference');
		Object.assign(foreachByReference.value, {
			iterable: variable('items'),
			value: variable('item'),
			statements: [],
		});

		for (const operation of [
			() => ifStatement(conditional.value as never),
			() => foreachStatement(foreachStatements.value as never),
			() => foreachStatement(foreachByReference.value as never),
		]) {
			expect(operation).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'INVALID_STATEMENT',
				})
			);
		}
		expect(conditional.reads()).toBe(0);
		expect(foreachStatements.reads()).toBe(0);
		expect(foreachByReference.reads()).toBe(0);
	});

	it('rejects ambiguous foreach variables', () => {
		expect(() =>
			foreachStatement({
				iterable: [],
				value: buildScalarInt(1) as never,
				statements: [],
			})
		).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_STATEMENT',
				path: '$foreach.value',
			})
		);
	});

	it.each([
		[
			'conditional elseIf branches',
			(input: unknown[]) =>
				ifStatement({
					condition: true,
					statements: [],
					elseIf: input as never,
				}),
		],
		[
			'statement lists',
			(input: unknown[]) => renderPhpStatements(input as never),
		],
	])(
		'rejects accessor-backed map on %s without evaluating it',
		(_label, operation) => {
			const input = accessorMapArray();

			expect(() => operation(input.value)).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'INVALID_STATEMENT',
				})
			);
			expect(input.reads()).toBe(0);
		}
	);
});

function accessorOption(key: string): {
	readonly value: Record<string, unknown>;
	readonly reads: () => number;
} {
	let reads = 0;
	const value: Record<string, unknown> = {};
	Object.defineProperty(value, key, {
		enumerable: true,
		get: () => {
			reads += 1;
			return [];
		},
	});
	return { value, reads: () => reads };
}

function accessorMapArray<T = never>(): {
	readonly value: T[];
	readonly reads: () => number;
} {
	let reads = 0;
	const value = [] as T[];
	Object.defineProperty(value, 'map', {
		enumerable: true,
		get: () => {
			reads += 1;
			throw new Error('must not invoke map');
		},
	});
	return { value, reads: () => reads };
}
