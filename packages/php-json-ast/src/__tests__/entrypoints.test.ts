import * as packageIndex from '../index';
import * as programBuilder from '../programBuilder';
import * as programWriter from '../programWriter';
import * as context from '../context';
import * as builderChannel from '../builderChannel';
import * as codec from '../codec/public';
import * as authoring from '../authoring/public';

describe('package entrypoints', () => {
	it('re-exports builder helpers through the package index', () => {
		expect(packageIndex.createPhpProgramBuilder).toBe(
			programBuilder.createPhpProgramBuilder
		);
		expect(packageIndex.createHelper).toBe(programBuilder.createHelper);
		expect(packageIndex.createPhpProgramWriterHelper).toBe(
			programWriter.createPhpProgramWriterHelper
		);
	});

	it('re-exports channel helpers through the package index', () => {
		expect(packageIndex.getPhpBuilderChannel).toBe(
			builderChannel.getPhpBuilderChannel
		);
		expect(packageIndex.resetPhpBuilderChannel).toBe(
			builderChannel.resetPhpBuilderChannel
		);
		expect(packageIndex.getPhpAstChannel).toBe(context.getPhpAstChannel);
		expect(packageIndex.resetPhpAstChannel).toBe(
			context.resetPhpAstChannel
		);
	});

	it('provides the canonical codec through its explicit public front', () => {
		expect(codec.decodePhpJsonAst(codec.encodePhpJsonAst([]))).toEqual([]);
		expect(codec.PHP_JSON_AST_FORMAT).toBe('php-json-ast');
		expect(codec.PHP_JSON_AST_VERSION).toBe(1);
	});

	it('provides framework-neutral values through the authoring front', () => {
		expect(
			authoring.renderPhpValue({ page: authoring.variable('page') })
		).toMatchObject({
			nodeType: 'Expr_Array',
			items: [
				{
					key: { value: 'page' },
					value: { nodeType: 'Expr_Variable', name: 'page' },
				},
			],
		});
	});

	it('keeps the authoring runtime surface explicit', () => {
		expect(Object.keys(authoring).sort()).toEqual([
			'PhpAuthoringError',
			'arrayExpression',
			'assignment',
			'expression',
			'expressionStatement',
			'foreachStatement',
			'functionCall',
			'ifStatement',
			'isPhpVariableValue',
			'methodCall',
			'normalizePhpVariableReference',
			'renderPhpStatement',
			'renderPhpStatements',
			'renderPhpValue',
			'returnStatement',
			'variable',
		]);
	});

	it('provides bounded expressions and statements through the authoring front', () => {
		const explicitEntries: readonly authoring.PhpArrayEntry[] = [
			{ key: 'post_type', value: 'book' },
		];
		const statements = authoring.renderPhpStatements([
			authoring.expressionStatement(
				authoring.assignment(
					'result',
					authoring.methodCall(
						authoring.variable('repository'),
						'find',
						[authoring.arrayExpression(explicitEntries)]
					)
				)
			),
			authoring.ifStatement({
				condition: authoring.functionCall('is_wp_error', [
					authoring.variable('result'),
				]),
				statements: [authoring.returnStatement(null)],
				else: [
					authoring.foreachStatement({
						iterable: authoring.variable('result'),
						key: 'key',
						value: 'item',
						statements: [
							authoring.returnStatement(
								authoring.variable('item')
							),
						],
					}),
				],
			}),
		]);

		expect(statements).toMatchObject([
			{
				nodeType: 'Stmt_Expression',
				expr: {
					nodeType: 'Expr_Assign',
					expr: { nodeType: 'Expr_MethodCall' },
				},
			},
			{
				nodeType: 'Stmt_If',
				cond: { nodeType: 'Expr_FuncCall' },
				stmts: [{ nodeType: 'Stmt_Return' }],
				else: {
					stmts: [{ nodeType: 'Stmt_Foreach' }],
				},
			},
		]);
	});
});
