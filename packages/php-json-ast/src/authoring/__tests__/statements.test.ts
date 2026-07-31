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
});
