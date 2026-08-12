import {
	isPromiseLike,
	maybeAll,
	processSequentially,
	maybeTry,
} from '../async-utils';

describe('async-utils', () => {
	describe('maybeAll', () => {
		it('preserves synchronous values', () => {
			const result = maybeAll([1, 2, 3]);

			expect(isPromiseLike(result)).toBe(false);
			expect(result).toEqual([1, 2, 3]);
		});

		it('adopts mixed asynchronous values', async () => {
			await expect(maybeAll([1, Promise.resolve(2), 3])).resolves.toEqual(
				[1, 2, 3]
			);
		});

		it('adopts thenables without reading their then property', async () => {
			let reads = 0;
			const thenable = new Proxy(
				{
					then(resolve: (value: number) => void) {
						resolve(2);
					},
				},
				{
					get() {
						reads += 1;
						throw new Error(
							'then must be read from its descriptor'
						);
					},
				}
			) as unknown as Promise<number>;

			await expect(maybeAll([1, thenable, 3])).resolves.toEqual([
				1, 2, 3,
			]);
			expect(reads).toBe(0);
		});
	});

	describe('processSequentially', () => {
		it('handles async handlers in forward direction', async () => {
			const items = [1, 2, 3];
			const result: number[] = [];
			await processSequentially(items, async (item) => {
				await Promise.resolve();
				result.push(item);
			});
			expect(result).toEqual([1, 2, 3]);
		});

		it('handles async handlers in reverse direction', async () => {
			const items = [1, 2, 3];
			const result: number[] = [];
			await processSequentially(
				items,
				async (item) => {
					await Promise.resolve();
					result.push(item);
				},
				'reverse'
			);
			expect(result).toEqual([3, 2, 1]);
		});

		it('adopts handler thenables without reading their then property', async () => {
			const visited: number[] = [];
			let reads = 0;

			await processSequentially([1, 2], (item) => {
				visited.push(item);
				return new Proxy(
					{
						then(resolve: () => void) {
							resolve();
						},
					},
					{
						get() {
							reads += 1;
							throw new Error(
								'then must be read from its descriptor'
							);
						},
					}
				) as unknown as Promise<void>;
			});

			expect(visited).toEqual([1, 2]);
			expect(reads).toBe(0);
		});
	});

	describe('maybeTry', () => {
		it('handles sync error in run', () => {
			const result = maybeTry(
				() => {
					throw new Error('sync error');
				},
				() => 'recovered'
			);
			expect(result).toBe('recovered');
		});
	});
});
