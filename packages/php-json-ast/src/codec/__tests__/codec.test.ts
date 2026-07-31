import {
	createPhpJsonAstEnvelope,
	decodePhpJsonAst,
	decodePhpJsonAstEnvelope,
	encodePhpJsonAst,
	parsePhpJsonAstEnvelope,
} from '../codec';
import { normalizePhpJsonAst } from '../normalize';
import {
	PHP_JSON_AST_FORMAT,
	PHP_JSON_AST_VERSION,
	PhpJsonAstCodecError,
} from '../protocol';

function expectCodecError(
	operation: () => unknown,
	code: PhpJsonAstCodecError['code']
): void {
	try {
		operation();
		throw new Error('Expected the codec operation to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(PhpJsonAstCodecError);
		expect((error as PhpJsonAstCodecError).code).toBe(code);
	}
}

describe('PHP JSON AST codec', () => {
	it('normalizes attributes, comments, positions, and object order', () => {
		const program = [
			{
				stmts: [
					{
						value: -0,
						nodeType: 'Scalar_Int',
						attributes: {
							endLine: 4,
							custom: { z: true, a: false },
							startLine: 4,
						},
					},
				],
				nodeType: 'Stmt_Echo',
				attributes: {
					startFilePos: 20,
					comments: [
						{
							endFilePos: 19,
							text: '// first',
							nodeType: 'Comment',
							line: 2,
						},
						{
							text: '/** second */',
							nodeType: 'Comment_Doc',
						},
					],
					zeta: 'kept',
					alpha: 'kept',
				},
			},
		];

		expect(normalizePhpJsonAst(program)).toEqual([
			{
				nodeType: 'Stmt_Echo',
				attributes: {
					alpha: 'kept',
					comments: [
						{ nodeType: 'Comment', text: '// first' },
						{
							nodeType: 'Comment_Doc',
							text: '/** second */',
						},
					],
					zeta: 'kept',
				},
				stmts: [
					{
						nodeType: 'Scalar_Int',
						attributes: {
							custom: { a: false, z: true },
						},
						value: 0,
					},
				],
			},
		]);
		expect(program[0]?.attributes.startFilePos).toBe(20);
		expect(program[0]?.attributes.comments[0]?.line).toBe(2);
	});

	it('adds empty attributes and preserves statement and comment order', () => {
		expect(
			normalizePhpJsonAst([
				{
					nodeType: 'Stmt_Nop',
					attributes: {
						comments: [
							{ nodeType: 'Comment', text: '// one' },
							{ nodeType: 'Comment', text: '// two' },
						],
					},
				},
				{ nodeType: 'Stmt_Return', expr: null },
			])
		).toEqual([
			{
				nodeType: 'Stmt_Nop',
				attributes: {
					comments: [
						{ nodeType: 'Comment', text: '// one' },
						{ nodeType: 'Comment', text: '// two' },
					],
				},
			},
			{
				nodeType: 'Stmt_Return',
				attributes: {},
				expr: null,
			},
		]);
	});

	it('encodes deterministically regardless of input object insertion order', () => {
		const first = [
			{
				nodeType: 'Stmt_Return',
				expr: {
					nodeType: 'Scalar_String',
					value: 'ok',
					attributes: { z: 2, a: 1 },
				},
			},
		];
		const second = [
			{
				expr: {
					attributes: { a: 1, z: 2 },
					value: 'ok',
					nodeType: 'Scalar_String',
				},
				nodeType: 'Stmt_Return',
			},
		];

		expect(encodePhpJsonAst(first)).toBe(encodePhpJsonAst(second));
		expect(JSON.parse(encodePhpJsonAst(first))).toEqual({
			format: PHP_JSON_AST_FORMAT,
			version: PHP_JSON_AST_VERSION,
			program: normalizePhpJsonAst(first),
		});
	});

	it('round-trips through the versioned envelope', () => {
		const program = [{ nodeType: 'Stmt_Nop', attributes: {} }];
		const encoded = encodePhpJsonAst(program);

		expect(parsePhpJsonAstEnvelope(encoded)).toEqual(
			createPhpJsonAstEnvelope(program)
		);
		expect(decodePhpJsonAst(encoded)).toEqual(program);
	});

	it('rejects unsupported versions', () => {
		expectCodecError(
			() =>
				decodePhpJsonAstEnvelope({
					format: PHP_JSON_AST_FORMAT,
					version: PHP_JSON_AST_VERSION + 1,
					program: [],
				}),
			'UNSUPPORTED_VERSION'
		);
	});

	it.each([
		['non-object', null],
		[
			'wrong format',
			{ format: 'other', version: PHP_JSON_AST_VERSION, program: [] },
		],
		[
			'missing program',
			{ format: PHP_JSON_AST_FORMAT, version: PHP_JSON_AST_VERSION },
		],
		[
			'extra fields',
			{
				format: PHP_JSON_AST_FORMAT,
				version: PHP_JSON_AST_VERSION,
				program: [],
				metadata: {},
			},
		],
		[
			'non-integer version',
			{ format: PHP_JSON_AST_FORMAT, version: '1', program: [] },
		],
	])('rejects malformed envelopes: %s', (_label, envelope) => {
		expectCodecError(
			() => decodePhpJsonAstEnvelope(envelope),
			'MALFORMED_ENVELOPE'
		);
	});

	it('rejects accessor, symbol, and non-enumerable envelope fields', () => {
		const accessorEnvelope = {
			format: PHP_JSON_AST_FORMAT,
			version: PHP_JSON_AST_VERSION,
			get program() {
				return [];
			},
		};
		const symbolEnvelope = {
			format: PHP_JSON_AST_FORMAT,
			version: PHP_JSON_AST_VERSION,
			program: [],
			[Symbol('metadata')]: true,
		};
		const hiddenEnvelope = {
			format: PHP_JSON_AST_FORMAT,
			version: PHP_JSON_AST_VERSION,
			program: [],
		};
		Object.defineProperty(hiddenEnvelope, 'metadata', { value: true });

		for (const envelope of [
			accessorEnvelope,
			symbolEnvelope,
			hiddenEnvelope,
		]) {
			expectCodecError(
				() => decodePhpJsonAstEnvelope(envelope),
				'MALFORMED_ENVELOPE'
			);
		}
	});

	it('rejects invalid serialized JSON', () => {
		expectCodecError(() => parsePhpJsonAstEnvelope('{'), 'INVALID_JSON');
		expectCodecError(
			() => parsePhpJsonAstEnvelope(null as unknown as string),
			'INVALID_JSON'
		);
	});

	it.each([
		['non-array program', {}],
		['non-statement root', [{ nodeType: 'Scalar_Int', value: 1 }]],
		['missing node type', [{}]],
		['invalid attributes', [{ nodeType: 'Stmt_Nop', attributes: [] }]],
		[
			'invalid comments',
			[
				{
					nodeType: 'Stmt_Nop',
					attributes: { comments: [{ nodeType: 'Name' }] },
				},
			],
		],
	])('rejects malformed programs: %s', (_label, program) => {
		expectCodecError(
			() => createPhpJsonAstEnvelope(program),
			'INVALID_PROGRAM'
		);
	});

	it('rejects values that JSON cannot represent canonically', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;
		const sparse = new Array(1);
		const arrayWithProperty = Object.assign([], { extra: true });
		const arrayWithHiddenProperty: unknown[] = [];
		Object.defineProperty(arrayWithHiddenProperty, 'extra', {
			value: true,
		});
		const arrayWithAccessor = [null];
		Object.defineProperty(arrayWithAccessor, '0', {
			enumerable: true,
			get: () => null,
		});
		const symbolKeyed = {
			nodeType: 'Scalar_String',
			value: 'ok',
			[Symbol('metadata')]: true,
		};
		expectCodecError(
			() =>
				normalizePhpJsonAst([
					{ nodeType: 'Stmt_Nop', attributes: undefined },
				]),
			'NON_JSON_VALUE'
		);

		for (const value of [
			undefined,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			BigInt(1),
			() => undefined,
			new Date(),
			cyclic,
			sparse,
			arrayWithProperty,
			arrayWithHiddenProperty,
			arrayWithAccessor,
			symbolKeyed,
		]) {
			expectCodecError(
				() =>
					normalizePhpJsonAst([
						{ nodeType: 'Stmt_Return', expr: value },
					]),
				'NON_JSON_VALUE'
			);
		}
	});
});
