import { observeMaybePromise } from '../maybePromise.js';

describe('CLI MaybePromise observer', () => {
	it('preserves synchronous values without promotion', () => {
		expect(observeMaybePromise<string>('value')).toEqual({
			kind: 'synchronous',
			value: 'value',
		});
		expect(observeMaybePromise<object>({})).toMatchObject({
			kind: 'synchronous',
		});
	});

	it('reads then once and preserves first settlement', async () => {
		let reads = 0;
		const observed = observeMaybePromise<string>({
			get then() {
				reads += 1;
				return (
					resolve: (value: string) => void,
					reject: (error: unknown) => void
				) => {
					resolve('first');
					reject(new Error('late'));
				};
			},
		});
		expect(observed.kind).toBe('asynchronous');
		if (observed.kind === 'asynchronous') {
			await expect(observed.promise).resolves.toBe('first');
		}
		expect(reads).toBe(1);
	});

	it('contains throwing getters and then methods', async () => {
		const getterError = new Error('getter');
		expect(
			observeMaybePromise({
				get then(): never {
					throw getterError;
				},
			})
		).toEqual({ kind: 'failed', error: getterError });

		const observed = observeMaybePromise({
			then() {
				throw new Error('method');
			},
		});
		if (observed.kind === 'asynchronous') {
			await expect(observed.promise).rejects.toThrow('method');
		}
	});
});
