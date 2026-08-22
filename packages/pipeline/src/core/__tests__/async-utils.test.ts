import {
	isPromiseLike,
	maybeAll,
	processSequentially,
	maybeTry,
} from '../async-utils';
import type { MaybePromise } from '../types';

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

		it('preserves heterogeneous readonly tuple inference', async () => {
			const result: MaybePromise<[1, string]> = maybeAll([
				1,
				Promise.resolve('two'),
			] as const);

			await expect(result).resolves.toEqual([1, 'two']);
		});

		it('does not observe a synchronous value again when a sibling is asynchronous', async () => {
			let reads = 0;
			const direct = Object.defineProperty({ value: 1 }, 'then', {
				get: () => {
					reads += 1;
					if (reads > 1) {
						throw new Error('then read twice');
					}
					return undefined;
				},
			});

			await expect(
				maybeAll([direct, Promise.resolve({ value: 2 })])
			).resolves.toEqual([direct, { value: 2 }]);
			expect(reads).toBe(1);
		});

		it('reads then once and invokes it through asynchronous adoption', async () => {
			let reads = 0;
			let invocations = 0;
			const thenable = Object.defineProperty({}, 'then', {
				get: () => {
					reads += 1;
					return (resolve: (value: number) => void) => {
						invocations += 1;
						resolve(2);
					};
				},
			}) as PromiseLike<number>;

			const result = maybeAll([1, thenable, 3]);
			expect(reads).toBe(1);
			expect(invocations).toBe(0);
			await expect(result).resolves.toEqual([1, 2, 3]);
			expect(invocations).toBe(1);
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

		it('adopts handler thenables through one property read', async () => {
			const visited: number[] = [];
			let reads = 0;

			await processSequentially([1, 2], (item) => {
				visited.push(item);
				return Object.defineProperty({}, 'then', {
					get: () => {
						reads += 1;
						return (resolve: () => void) => resolve();
					},
				}) as PromiseLike<void>;
			});

			expect(visited).toEqual([1, 2]);
			expect(reads).toBe(2);
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
