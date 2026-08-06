import { isPromiseLike, maybeAll, maybeThen, maybeTry } from '../async-utils';

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

	it('returns sync array for maybeAll when no promises', () => {
		const input = [1, 2, 3] as const;
		const result = maybeAll(input);
		expect(result).toEqual([1, 2, 3]);
		expect(result).not.toBe(input);
	});

	it('adopts non-native thenables across map, collect and recovery', async () => {
		await expect(
			maybeThen(thenable(2), (value) => value * 3)
		).resolves.toBe(6);
		await expect(maybeAll([1, thenable(2), 3])).resolves.toEqual([1, 2, 3]);
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

	it('does not invoke accessor-backed then properties', () => {
		let reads = 0;
		const hostile = Object.defineProperty({ value: 1 }, 'then', {
			get: () => {
				reads += 1;
				throw new Error('then accessor must not execute');
			},
		});

		expect(isPromiseLike(hostile)).toBe(false);
		expect(maybeThen(hostile, (value) => value)).toBe(hostile);
		expect(maybeAll([hostile])).toEqual([hostile]);
		expect(reads).toBe(0);
	});

	it('contains descriptor and prototype traps without reading then', () => {
		let gets = 0;
		const descriptorHostile = new Proxy(
			{ then: () => undefined },
			{
				getOwnPropertyDescriptor: () => {
					throw new Error('descriptor trap');
				},
				get: () => {
					gets += 1;
					throw new Error('get trap');
				},
			}
		);
		const prototypeHostile = new Proxy(
			{},
			{
				getPrototypeOf: () => {
					throw new Error('prototype trap');
				},
				get: () => {
					gets += 1;
					throw new Error('get trap');
				},
			}
		);

		expect(isPromiseLike(descriptorHostile)).toBe(false);
		expect(isPromiseLike(prototypeHostile)).toBe(false);
		expect(gets).toBe(0);
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
