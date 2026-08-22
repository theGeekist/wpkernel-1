import { copyGraphValue } from '../../graph/index.js';

describe('iterative graph value ownership', () => {
	it('copies and freezes an ordinary array nested 15,000 levels deep', () => {
		const depth = 15_000;
		let value: unknown = 'leaf';
		for (let level = 0; level < depth; level += 1) {
			value = [value];
		}

		const result = copyGraphValue({ value });

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.reason);
		}
		let copied: unknown = result.value;
		for (let level = 0; level < depth; level += 1) {
			if (!Array.isArray(copied) || !Object.isFrozen(copied)) {
				throw new Error(`Invalid copied array at level ${level}.`);
			}
			copied = copied[0];
		}
		expect(copied).toBe('leaf');
	}, 30_000);

	it('copies and freezes a plain record nested 15,000 levels deep', () => {
		const depth = 15_000;
		let value: unknown = 'leaf';
		for (let level = 0; level < depth; level += 1) {
			value = { next: value };
		}

		const result = copyGraphValue({ value });

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.reason);
		}
		let copied: unknown = result.value;
		for (let level = 0; level < depth; level += 1) {
			if (
				!copied ||
				typeof copied !== 'object' ||
				Array.isArray(copied) ||
				!Object.isFrozen(copied) ||
				Object.getPrototypeOf(copied) !== null
			) {
				throw new Error(`Invalid copied record at level ${level}.`);
			}
			copied = (copied as Record<string, unknown>).next;
		}
		expect(copied).toBe('leaf');
	}, 30_000);
});
