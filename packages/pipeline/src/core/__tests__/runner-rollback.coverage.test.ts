import { rollbackStateToHalt } from '../runner/rollback';
import type { PipelineRollback } from '../rollback';
import { isRollbackApplied, rollbackJournalState } from '../runner/state';

describe('runner rollback coverage', () => {
	it('rolls back one journal in reverse execution chronology', async () => {
		const handlerCalls: unknown[] = [];
		const chronology: string[] = [];
		const extensionRollback = jest.fn(() => {
			chronology.push('extension');
			throw new Error('rollback failed');
		});
		const hook = {
			key: 'extension',
			lifecycle: 'after-fragments' as const,
			hook: () => undefined,
		};
		const state = {
			context: {},
			[rollbackJournalState]: [
				{
					source: 'helper' as const,
					entries: [
						{
							helper: { key: 'first-helper' },
							rollback: {
								run: () => chronology.push('first-helper'),
							} as PipelineRollback,
						},
					],
				},
				{
					source: 'extension' as const,
					state: {
						artifact: {},
						results: [
							{ hook, result: { rollback: extensionRollback } },
						],
						hooks: [hook],
					},
				},
				{
					source: 'helper' as const,
					entries: [
						{
							helper: { key: 'last-helper' },
							rollback: {
								run: () => chronology.push('last-helper'),
							} as PipelineRollback,
						},
					],
				},
			],
			onExtensionRollbackError: (event: { error: unknown }) =>
				handlerCalls.push(event.error),
		};
		const error = new Error('fail');

		const halt = await rollbackStateToHalt(state, error, (failure) => ({
			__halt: true,
			error: failure,
		}));

		expect(extensionRollback).toHaveBeenCalledTimes(1);
		expect(chronology).toEqual([
			'last-helper',
			'extension',
			'first-helper',
		]);
		expect(handlerCalls).toEqual([expect.any(Error)]);
		expect(halt).toMatchObject({
			__halt: true,
			error,
		});
		expect(isRollbackApplied(halt)).toBe(true);
	});

	it('attributes reused rollback descriptors to each helper occurrence', async () => {
		const sharedRollback: PipelineRollback = {
			run: () => {
				throw new Error('rollback failed');
			},
		};
		const helperKeys: string[] = [];
		const state = {
			context: {},
			[rollbackJournalState]: [
				{
					source: 'helper' as const,
					entries: [
						{ helper: { key: 'first' }, rollback: sharedRollback },
						{ helper: { key: 'second' }, rollback: sharedRollback },
					],
				},
			],
		};

		await rollbackStateToHalt(
			state,
			new Error('pipeline failed'),
			(error) => ({ __halt: true, error }),
			({ helper }) => helperKeys.push(helper.key)
		);

		expect(helperKeys).toEqual(['second', 'first']);
	});
});
