import { commitSerialRun, compensateSerialRun } from '../serial-settlement.js';

function prepared(journal: readonly unknown[], overrides: object = {}) {
	return {
		journal,
		context: { reporter: {} },
		authority: {},
		...overrides,
	} as never;
}

describe('serial aggregate settlement', () => {
	it('commits admitted entries in order across sync and async work', async () => {
		const visited: string[] = [];
		await commitSerialRun(
			prepared([
				{
					source: 'helper',
					owner: {},
					commit: () => void visited.push('one'),
				},
				{ source: 'helper', owner: {} },
				{
					source: 'extension',
					owner: { key: 'ext' },
					commit: async () => void visited.push('two'),
				},
			])
		);
		expect(visited).toEqual(['one', 'two']);
	});

	it('stops commit at the first synchronous or asynchronous failure', async () => {
		expect(() =>
			commitSerialRun(
				prepared([
					{
						source: 'helper',
						owner: {},
						commit: () => {
							throw new Error('sync');
						},
					},
				])
			)
		).toThrow('sync');
		await expect(
			commitSerialRun(
				prepared([
					{
						source: 'helper',
						owner: {},
						commit: () => Promise.reject(new Error('async')),
					},
				])
			)
		).rejects.toThrow('async');
	});

	it('compensates in reverse and reports every failure', async () => {
		const visited: string[] = [];
		const helperFailure = jest.fn();
		const extensionFailure = jest.fn(() => {
			throw new Error('observer');
		});
		await expect(
			compensateSerialRun(
				prepared(
					[
						{
							source: 'helper',
							owner: { key: 'helper' },
							rollback: () => {
								visited.push('helper');
								throw new Error('helper failed');
							},
						},
						{ source: 'helper', owner: {} },
						{
							source: 'extension',
							owner: { key: 'ext' },
							rollback: async () => {
								visited.push('extension');
								throw new Error('extension failed');
							},
						},
					],
					{
						authority: {
							onHelperRollbackError: helperFailure,
							onExtensionRollbackError: extensionFailure,
						},
					}
				)
			)
		).rejects.toThrow('extension failed');
		expect(visited).toEqual(['extension', 'helper']);
		expect(helperFailure).toHaveBeenCalledTimes(1);
		expect(extensionFailure).toHaveBeenCalledTimes(1);
	});

	it('retains undefined and null compensation failures', async () => {
		for (const failure of [undefined, null]) {
			let rejected = false;
			try {
				await compensateSerialRun(
					prepared([
						{
							source: 'helper',
							owner: {},
							rollback: () => {
								throw failure;
							},
						},
					])
				);
			} catch (error) {
				rejected = true;
				expect(error).toBe(failure);
			}
			expect(rejected).toBe(true);
		}

		expect(() =>
			compensateSerialRun(
				prepared([
					{
						source: 'helper',
						owner: {},
						rollback: () => Promise.reject(undefined),
					},
				])
			)
		).rejects.toBeUndefined();

		const first = new Error('first');
		await expect(
			compensateSerialRun(
				prepared([
					{
						source: 'helper',
						owner: {},
						rollback: () => Promise.reject(new Error('later')),
					},
					{
						source: 'helper',
						owner: {},
						rollback: () => {
							throw first;
						},
					},
				])
			)
		).rejects.toBe(first);

		expect(() =>
			compensateSerialRun(
				prepared([
					{
						source: 'extension',
						owner: { key: 'extension' },
						rollback: () => {
							throw new Error('extension without observer');
						},
					},
				])
			)
		).toThrow('extension without observer');
	});
});
