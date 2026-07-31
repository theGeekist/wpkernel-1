import type { PhpAuthoringError } from '../errors';
import { normalizePhpVariableReference, variable } from '../references';

describe('PHP authoring references', () => {
	it.each([
		['items', { raw: 'items', display: '$items' }],
		[' $items ', { raw: 'items', display: '$items' }],
		['_private2', { raw: '_private2', display: '$_private2' }],
		['über', { raw: 'über', display: '$über' }],
	])('normalizes simple variable reference %s', (input, expected) => {
		expect(normalizePhpVariableReference(input)).toEqual(expected);
	});

	it('creates an immutable normalized variable descriptor', () => {
		const descriptor = variable(' $items ');

		expect(descriptor).toMatchObject({
			kind: 'variable',
			name: 'items',
		});
		expect(Object.isFrozen(descriptor)).toBe(true);
	});

	it.each(['', '   ', '$', '$$items', 'item-key', 'items[0]', 'a->b'])(
		'rejects ambiguous variable reference %p',
		(input) => {
			expect(() => variable(input)).toThrow(
				expect.objectContaining<Partial<PhpAuthoringError>>({
					code: 'INVALID_VARIABLE_REFERENCE',
					path: '$variable',
					hint: expect.stringContaining('expression'),
				})
			);
		}
	);
});
