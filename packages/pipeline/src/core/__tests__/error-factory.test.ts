import { createDefaultError } from '../error-factory';

describe('error-factory', () => {
	describe('createDefaultError', () => {
		it('returns an Error with prefixed message and code property', () => {
			const error = createDefaultError(
				'ValidationError',
				'invalid payload'
			);

			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe('[ValidationError] invalid payload');
			expect((error as Error & { code: string }).code).toBe(
				'ValidationError'
			);
		});
	});
});
