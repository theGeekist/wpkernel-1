import { buildScalarInt } from '../../nodes';
import type { PhpAuthoringError } from '../errors';
import {
	arrayExpression,
	assignment,
	functionCall,
	methodCall,
} from '../expressions';
import { variable } from '../references';
import { expression } from '../values';

describe('PHP expression authoring', () => {
	it('authors qualified function calls from values and references', () => {
		const call = functionCall('\\Vendor\\lookup', [
			'book',
			variable('$id'),
		]);

		expect(call.expr).toMatchObject({
			nodeType: 'Expr_FuncCall',
			name: {
				nodeType: 'Name_FullyQualified',
				parts: ['Vendor', 'lookup'],
			},
			args: [
				{ value: { nodeType: 'Scalar_String', value: 'book' } },
				{ value: { nodeType: 'Expr_Variable', name: 'id' } },
			],
		});
	});

	it('authors method calls on variables and authored expressions', () => {
		const chained = methodCall(
			methodCall(variable('repository'), 'find', [5]),
			'getTitle'
		);

		expect(chained.expr).toMatchObject({
			nodeType: 'Expr_MethodCall',
			var: {
				nodeType: 'Expr_MethodCall',
				var: { nodeType: 'Expr_Variable', name: 'repository' },
				name: { nodeType: 'Identifier', name: 'find' },
			},
			name: { nodeType: 'Identifier', name: 'getTitle' },
		});
	});

	it('authors assignment to validated variables', () => {
		expect(
			assignment('$result', functionCall('lookup', [1])).expr
		).toMatchObject({
			nodeType: 'Expr_Assign',
			var: { nodeType: 'Expr_Variable', name: 'result' },
			expr: { nodeType: 'Expr_FuncCall' },
		});
	});

	it('authors explicit keyed, referenced, and unpacked arrays', () => {
		const authored = arrayExpression([
			{ key: 'kind', value: 'book' },
			{ value: variable('item'), byReference: true },
			{ value: variable('remaining'), unpack: true },
		]);

		expect(authored.expr).toMatchObject({
			nodeType: 'Expr_Array',
			items: [
				{
					key: { nodeType: 'Scalar_String', value: 'kind' },
					value: { nodeType: 'Scalar_String', value: 'book' },
				},
				{
					key: null,
					value: { nodeType: 'Expr_Variable', name: 'item' },
					byRef: true,
				},
				{
					key: null,
					value: { nodeType: 'Expr_Variable', name: 'remaining' },
					unpack: true,
				},
			],
		});
	});

	it.each([
		['function', () => functionCall('bad()', []), '$function'],
		[
			'method',
			() => methodCall(variable('subject'), 'bad-name'),
			'$method',
		],
		['assignment', () => assignment('bad-name', 1), '$variable'],
	])('rejects invalid %s identifiers', (_label, operation, path) => {
		expect(operation).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({ path })
		);
	});

	it.each(['byReference', 'unpack'] as const)(
		'rejects accessor-backed array entry %s without evaluating it',
		(option) => {
			let reads = 0;
			const entry = { value: 1 };
			Object.defineProperty(entry, option, {
				enumerable: true,
				get: () => {
					reads += 1;
					return true;
				},
			});

			expect(() => arrayExpression([entry])).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'AMBIGUOUS_VALUE',
					path: '$array[0]',
				})
			);
			expect(reads).toBe(0);
		}
	);

	it('rejects ambiguous raw method subjects', () => {
		expect(() => methodCall(buildScalarInt(1) as never, 'method')).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'AMBIGUOUS_VALUE',
				path: '$method.subject',
			})
		);
	});

	it.each([
		{ entries: [{ value: 1, byReference: true, unpack: true }] },
		{ entries: [{ value: 1, key: 'key', unpack: true }] },
		{ entries: [{ key: 'missing-value' }] },
	])('rejects ambiguous explicit array entries', ({ entries }) => {
		expect(() => arrayExpression(entries as never)).toThrow(
			expect.objectContaining<Partial<PhpAuthoringError>>({
				code: 'AMBIGUOUS_VALUE',
				path: '$array[0]',
			})
		);
	});

	it('accepts explicit existing expressions as call arguments', () => {
		const scalar = buildScalarInt(7);
		expect(
			functionCall('consume', [expression(scalar)]).expr
		).toMatchObject({
			args: [{ value: scalar }],
		});
	});

	it.each([
		[
			'function arguments',
			(input: unknown[]) => functionCall('consume', input as never),
		],
		[
			'method arguments',
			(input: unknown[]) =>
				methodCall(variable('subject'), 'consume', input as never),
		],
		[
			'array entries',
			(input: unknown[]) => arrayExpression(input as never),
		],
	])(
		'rejects accessor-backed map on %s without evaluating it',
		(_label, operation) => {
			const input = accessorMapArray();

			expect(() => operation(input.value)).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'AMBIGUOUS_VALUE',
				})
			);
			expect(input.reads()).toBe(0);
		}
	);
});

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
