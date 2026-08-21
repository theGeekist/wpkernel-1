import { copyGraphValue } from '../../graph/index.js';

describe('graph value ownership', () => {
	it('preserves every scalar variant at the root ownership boundary', () => {
		for (const value of [null, undefined, false, 0, 0n, ''] as const) {
			expect(copyGraphValue({ value })).toEqual({ ok: true, value });
		}
	});

	it('copies, freezes and preserves hostile own string keys', () => {
		const value = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(value, '__proto__', {
			enumerable: true,
			configurable: true,
			value: { constructor: ['before'] },
		});
		const result = copyGraphValue({ value });
		if (!result.ok) {
			throw new Error(result.reason);
		}
		(value.__proto__ as { constructor: string[] }).constructor[0] = 'after';

		expect(Object.keys(result.value as object)).toEqual(['__proto__']);
		expect(
			(result.value as Record<string, { constructor: string[] }>)
				.__proto__!.constructor
		).toEqual(['before']);
		expect(Object.getPrototypeOf(result.value as object)).toBeNull();
		expect(Object.isFrozen(result.value)).toBe(true);
		expect(
			Object.isFrozen((result.value as Record<string, object>).__proto__)
		).toBe(true);
	});

	it('rejects every hidden record state before reading values', () => {
		let reads = 0;
		const accessor = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(accessor, 'visible', {
			enumerable: true,
			get() {
				reads += 1;
				return 'x';
			},
		});
		const nonEnumerable = { visible: 'x' };
		Object.defineProperty(nonEnumerable, 'hidden', {
			enumerable: false,
			value: 'state',
		});

		expect(copyGraphValue({ value: accessor })).toMatchObject({
			ok: false,
		});
		expect(reads).toBe(0);
		expect(copyGraphValue({ value: nonEnumerable })).toMatchObject({
			ok: false,
		});
		expect(copyGraphValue({ value: { [Symbol('x')]: 'x' } })).toMatchObject(
			{ ok: false }
		);
	});

	it('rejects sparse, augmented, accessor, symbolic and hidden array state', () => {
		const sparse = new Array<unknown>(2);
		sparse[1] = 'x';
		const augmented = ['x'] as string[] & { extra?: string };
		augmented.extra = 'state';
		const accessor = ['x'];
		Object.defineProperty(accessor, '0', {
			enumerable: true,
			get: () => 'x',
		});
		const hidden = ['x'];
		Object.defineProperty(hidden, '0', {
			enumerable: false,
			value: 'x',
		});
		const symbolic = ['x'];
		Object.defineProperty(symbolic, Symbol('state'), {
			enumerable: true,
			value: 'x',
		});

		for (const value of [sparse, augmented, accessor, hidden, symbolic]) {
			expect(copyGraphValue({ value })).toMatchObject({ ok: false });
		}
	});

	it('does not depend on an array iterator and contains descriptor failures', () => {
		const withoutIterator = new Proxy(['x'], {
			get(target, property, receiver) {
				if (property === Symbol.iterator) {
					throw new Error('iterator must not be read');
				}
				return Reflect.get(target, property, receiver);
			},
		});
		const hostile = new Proxy(['x'], {
			getOwnPropertyDescriptor() {
				throw new Error('hostile descriptor');
			},
		});

		expect(copyGraphValue({ value: withoutIterator })).toMatchObject({
			ok: true,
			value: ['x'],
		});
		expect(copyGraphValue({ value: hostile })).toEqual({
			ok: false,
			reason: 'Graph values must be inspectable plain data.',
		});
	});

	it('requires exact Array.prototype while admitting transparent proxies', () => {
		class ArraySubclass extends Array<string> {}
		const transparentArray = new Proxy(['x', { nested: true }], {});
		const transparentRecord = new Proxy({ nested: ['x'] }, {});
		const exoticPrototype = new Proxy(['x'], {
			getPrototypeOf: () => null,
		});
		const throwingPrototype = new Proxy(['x'], {
			getPrototypeOf() {
				throw new Error('hostile prototype');
			},
		});

		expect(copyGraphValue({ value: new ArraySubclass('x') })).toMatchObject(
			{
				ok: false,
			}
		);
		expect(copyGraphValue({ value: transparentArray })).toMatchObject({
			ok: true,
			value: ['x', { nested: true }],
		});
		expect(copyGraphValue({ value: transparentRecord })).toMatchObject({
			ok: true,
			value: { nested: ['x'] },
		});
		expect(copyGraphValue({ value: exoticPrototype })).toMatchObject({
			ok: false,
		});
		expect(copyGraphValue({ value: throwingPrototype })).toEqual({
			ok: false,
			reason: 'Graph values must be inspectable plain data.',
		});
	});

	it('rejects cycles, shared aliases and values outside the closed algebra', () => {
		const cyclic: { self?: unknown } = {};
		cyclic.self = cyclic;
		const shared = { value: 'x' };

		expect(copyGraphValue({ value: cyclic })).toMatchObject({ ok: false });
		expect(copyGraphValue({ value: [shared, shared] })).toMatchObject({
			ok: false,
		});
		for (const value of [new Date(), new Map(), () => undefined]) {
			expect(copyGraphValue({ value })).toMatchObject({ ok: false });
		}
		expect(copyGraphValue({ value: { nested: new Date() } })).toMatchObject(
			{
				ok: false,
			}
		);
	});
});
