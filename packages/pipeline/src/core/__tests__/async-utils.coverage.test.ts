import { isPromiseLike, maybeThen, maybeTry } from '../async-utils';

const thenable = <T>(value: T): PromiseLike<T> => ({
	then: <TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
		_onrejected?:
			| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
			| null
	): PromiseLike<TResult1 | TResult2> =>
		Promise.resolve(
			onfulfilled ? onfulfilled(value) : (value as unknown as TResult1)
		),
});

describe('async-utils coverage', () => {
	it('throws when maybeThen receives non-function handler', () => {
		expect(() =>
			maybeThen<string, string>(
				'value',
				null as unknown as (value: string) => string
			)
		).toThrow('maybeThen: onFulfilled is not a function');
	});

	it('adopts non-native thenables across mapping and recovery', async () => {
		await expect(
			maybeThen(thenable(2), (value) => value * 3)
		).resolves.toBe(6);
		await expect(
			maybeTry(
				() =>
					({
						then: (
							_resolve: unknown,
							reject: (reason: unknown) => void
						) => reject(new Error('rejected')),
					}) as PromiseLike<string>,
				() => 'recovered'
			)
		).resolves.toBe('recovered');
	});

	it('adopts a thenable returned from synchronous mapping', async () => {
		let reads = 0;
		let invocations = 0;
		const result = maybeThen(
			2,
			(value) =>
				Object.defineProperty({}, 'then', {
					get: () => {
						reads += 1;
						return (resolve: (resolved: number) => void) => {
							invocations += 1;
							resolve(value * 4);
						};
					},
				}) as PromiseLike<number>
		);

		expect(reads).toBe(1);
		expect(invocations).toBe(0);
		await expect(result).resolves.toBe(8);
		expect(reads).toBe(1);
		expect(invocations).toBe(1);
	});

	it('adopts a thenable returned from synchronous recovery once', async () => {
		let reads = 0;
		let invocations = 0;
		const result = maybeTry(
			() => {
				throw new Error('recover');
			},
			() =>
				Object.defineProperty({}, 'then', {
					get: () => {
						reads += 1;
						return (resolve: (resolved: string) => void) => {
							invocations += 1;
							resolve('recovered');
						};
					},
				}) as PromiseLike<string>
		);

		expect(reads).toBe(1);
		expect(invocations).toBe(0);
		await expect(result).resolves.toBe('recovered');
		expect(reads).toBe(1);
		expect(invocations).toBe(1);
	});

	it('surfaces throwing then accessors synchronously', () => {
		let reads = 0;
		const hostile = () =>
			Object.defineProperty({ value: 1 }, 'then', {
				get: () => {
					reads += 1;
					throw new Error('then accessor failed');
				},
			});

		expect(() => isPromiseLike(hostile())).toThrow('then accessor failed');
		expect(() => maybeThen(hostile(), (value) => value)).toThrow(
			'then accessor failed'
		);
		expect(reads).toBe(2);
	});

	it('uses ordinary property access for proxy then traps', () => {
		let gets = 0;
		const hostile = new Proxy(
			{ then: () => undefined },
			{
				get: () => {
					gets += 1;
					throw new Error('get trap');
				},
			}
		);

		expect(() => isPromiseLike(hostile)).toThrow('get trap');
		expect(gets).toBe(1);
	});

	it('lets maybeTry recover a throwing then getter synchronously', () => {
		const hostile = Object.defineProperty({}, 'then', {
			get: () => {
				throw new Error('getter failed');
			},
		});

		expect(
			maybeTry(
				() => hostile,
				() => 'recovered'
			)
		).toBe('recovered');
	});

	it('turns a throwing data-method then into a rejection', async () => {
		const throwing = {
			then: () => {
				throw new Error('then failed');
			},
		} as PromiseLike<string>;

		await expect(maybeThen(throwing, (value) => value)).rejects.toThrow(
			'then failed'
		);
	});
});
