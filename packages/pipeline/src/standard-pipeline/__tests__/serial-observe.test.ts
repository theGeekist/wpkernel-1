import { chainObserved } from '../serial-observe.js';

describe('serial participant observation', () => {
	it('propagates a synchronously observed then-getter failure', () => {
		const failure = new Error('then getter failed');
		const hostile = Object.defineProperty({}, 'then', {
			get: () => {
				throw failure;
			},
		});

		expect(() => chainObserved(hostile, () => undefined)).toThrow(failure);
	});
});
