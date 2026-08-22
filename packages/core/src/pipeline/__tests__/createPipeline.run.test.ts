import { observeMaybePromise } from '../helpers/maybePromise';

describe('Core MaybePromise observation', () => {
	it('preserves synchronous values', () => {
		expect(observeMaybePromise('value')).toEqual({
			kind: 'synchronous',
			value: 'value',
		});
	});

	it('captures then exactly once', async () => {
		let reads = 0;
		const candidate = {
			get then() {
				reads += 1;
				return (resolve: (value: string) => void) => resolve('settled');
			},
		};
		const observed = observeMaybePromise<string>(candidate);

		expect(reads).toBe(1);
		expect(observed.kind).toBe('asynchronous');
		if (observed.kind === 'asynchronous') {
			await expect(observed.promise).resolves.toBe('settled');
		}
		expect(reads).toBe(1);
	});

	it('keeps a throwing then getter synchronous', () => {
		const error = new Error('getter failed');
		const observed = observeMaybePromise({
			get then(): never {
				throw error;
			},
		});

		expect(observed).toEqual({ kind: 'failed', error });
	});

	it('adopts only the first hostile settlement', async () => {
		const observed = observeMaybePromise<string>({
			then(
				resolve: (value: string) => void,
				reject: (reason: unknown) => void
			) {
				resolve('first');
				reject(new Error('late'));
				resolve('later');
			},
		});

		expect(observed.kind).toBe('asynchronous');
		if (observed.kind === 'asynchronous') {
			await expect(observed.promise).resolves.toBe('first');
		}
	});
});
