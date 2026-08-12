import { rollbackStateToHalt } from '../runner/rollback';
import type { PipelineRollback } from '../rollback';

describe('runner rollback coverage', () => {
	it('rolls back the authoritative extension stack', async () => {
		const handlerCalls: unknown[] = [];
		const rollback = jest.fn(() => {
			throw new Error('rollback failed');
		});
		const hook = {
			key: 'extension',
			lifecycle: 'after-fragments' as const,
			hook: () => undefined,
		};
		const state = {
			context: {},
			extensionStack: [
				{
					artifact: {},
					results: [{ hook, result: { rollback } }],
					hooks: [hook],
				},
			],
			onExtensionRollbackError: (event: { error: unknown }) =>
				handlerCalls.push(event.error),
			helperRollbackStack: [
				{
					helper: { key: 'helper' },
					rollback: {
						key: 'rb',
						run: () => undefined,
					} as PipelineRollback,
				},
			],
		};
		const error = new Error('fail');

		const halt = await rollbackStateToHalt(state, error, (failure) => ({
			__halt: true,
			error: failure,
		}));

		expect(rollback).toHaveBeenCalledTimes(1);
		expect(handlerCalls).toEqual([expect.any(Error)]);
		expect(halt).toMatchObject({
			__halt: true,
			__hasError: true,
			__rollbackApplied: true,
			error,
		});
	});
});
