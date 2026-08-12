import { createHelper } from '../helper';

describe('createHelper', () => {
	it('isolates and freezes dependency metadata', () => {
		const dependencies = ['first'];
		const helper = createHelper({
			key: 'test',
			kind: 'fragment',
			dependsOn: dependencies,
			apply: () => undefined,
		});

		dependencies.push('second');

		expect(helper.dependsOn).toEqual(['first']);
		expect(Object.isFrozen(helper.dependsOn)).toBe(true);
		expect(() => (helper.dependsOn as string[]).push('third')).toThrow();
	});
});
