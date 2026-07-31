import {
	buildIdentifier,
	buildMethodCall,
	buildScalarInt,
	buildVariable,
} from '../../nodes';
import type { PhpAuthoringError } from '../errors';
import { variable } from '../references';
import { expression, renderPhpValue } from '../values';

describe('PHP authoring values', () => {
	it.each([
		['text', 'Scalar_String', 'text'],
		[42, 'Scalar_Int', 42],
		[-0, 'Scalar_Int', 0],
		[1.5, 'Scalar_Float', 1.5],
	])('authors scalar %p as %s', (input, nodeType, output) => {
		expect(renderPhpValue(input)).toMatchObject({
			nodeType,
			value: output,
		});
	});

	it.each([
		[true, 'true'],
		[false, 'false'],
		[null, 'null'],
	])('authors constant %p', (input, name) => {
		expect(renderPhpValue(input)).toMatchObject({
			nodeType: 'Expr_ConstFetch',
			name: {
				nodeType: 'Name',
				parts: [name],
			},
		});
	});

	it('authors nested lists, records, variables, and expressions', () => {
		const existing = buildMethodCall(
			buildVariable('repository'),
			buildIdentifier('find'),
			[]
		);
		const rendered = renderPhpValue({
			post_type: 'book',
			statuses: ['draft', 'publish'],
			page: variable('$page'),
			result: expression(existing),
		});

		expect(rendered).toMatchObject({
			nodeType: 'Expr_Array',
			items: [
				{
					nodeType: 'ArrayItem',
					key: { nodeType: 'Scalar_String', value: 'post_type' },
					value: { nodeType: 'Scalar_String', value: 'book' },
				},
				{
					key: { value: 'statuses' },
					value: {
						nodeType: 'Expr_Array',
						items: [
							{ key: null, value: { value: 'draft' } },
							{ key: null, value: { value: 'publish' } },
						],
					},
				},
				{
					key: { value: 'page' },
					value: { nodeType: 'Expr_Variable', name: 'page' },
				},
				{
					key: { value: 'result' },
					value: existing,
				},
			],
		});
	});

	it('preserves an already-authored expression by identity', () => {
		const existing = buildScalarInt(5);
		expect(renderPhpValue(expression(existing))).toBe(existing);
	});

	it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
		'rejects non-finite number %p with its nested path',
		(value) => {
			expect(() => renderPhpValue({ nested: [value] })).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'NON_FINITE_NUMBER',
					path: '$.nested[0]',
				})
			);
		}
	);

	it('rejects unsafe integers', () => {
		expect(() => renderPhpValue(Number.MAX_SAFE_INTEGER + 1)).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'UNSAFE_INTEGER',
				hint: expect.stringContaining('string'),
			})
		);
	});

	it('rejects cyclic values with the precise cycle path', () => {
		const cyclic: Record<string, unknown> = {};
		cyclic.self = cyclic;

		expect(() => renderPhpValue(cyclic as never)).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'CYCLIC_VALUE',
				path: '$.self',
			})
		);
	});

	it.each([
		['undefined', undefined, 'UNSUPPORTED_VALUE'],
		['bigint', BigInt(1), 'UNSUPPORTED_VALUE'],
		['function', () => undefined, 'UNSUPPORTED_VALUE'],
		['date', new Date(), 'AMBIGUOUS_VALUE'],
		['raw expression', buildScalarInt(1), 'AMBIGUOUS_VALUE'],
	] as const)(
		'rejects ambiguous or unsupported %s input',
		(_label, value, code) => {
			expect(() => renderPhpValue(value as never)).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({ code })
			);
		}
	);

	it('rejects sparse and augmented arrays', () => {
		const sparse = new Array(1);
		const augmented = Object.assign([], { keyed: true });
		const hidden: unknown[] = [];
		Object.defineProperty(hidden, 'keyed', { value: true });
		const accessor = [null];
		Object.defineProperty(accessor, '0', {
			enumerable: true,
			get: () => null,
		});
		const symbolKeyed = Object.assign([], {
			[Symbol('keyed')]: true,
		});

		for (const value of [
			sparse,
			augmented,
			hidden,
			accessor,
			symbolKeyed,
		]) {
			expect(() => renderPhpValue(value as never)).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'AMBIGUOUS_VALUE',
				})
			);
		}
	});

	it('rejects malformed expression descriptors at creation', () => {
		expect(() => expression({ nodeType: 'Stmt_Return' } as never)).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_EXPRESSION',
				path: '$expression',
			})
		);
		expect(() => expression({ nodeType: 'ArrayItem' } as never)).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'INVALID_EXPRESSION',
			})
		);
	});
});
