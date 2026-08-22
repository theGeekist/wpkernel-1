import {
	runExtensionHooks,
	rollbackExtensionResults,
	commitExtensionResults,
} from '../extensions';
import type { ExtensionHookEntry, ExtensionHookExecution } from '../extensions';

type TestArtifact = { artifact: string };
type TestContext = Record<string, never>;
type TestOptions = Record<string, never>;

function observedThenable<T>(value: T): {
	readonly promise: Promise<T>;
	readonly getThenReads: () => number;
} {
	let thenReads = 0;
	const promise = Object.defineProperty({}, 'then', {
		get: () => {
			thenReads += 1;
			return (resolve: (resolved: T) => void) => resolve(value);
		},
	}) as unknown as Promise<T>;

	return { promise, getThenReads: () => thenReads };
}

describe('extensions', () => {
	describe('runExtensionHooks', () => {
		it('adopts hook thenables through one then property read', async () => {
			const hookResult = observedThenable({
				artifact: { artifact: 'adopted' },
			});
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'hostile-hook',
					lifecycle: 'after-fragments',
					hook: () => hookResult.promise,
				},
			];

			await expect(
				runExtensionHooks(
					hooks,
					'after-fragments',
					{ artifact: { artifact: 'initial' } } as any,
					() => undefined
				)
			).resolves.toMatchObject({
				artifact: { artifact: 'adopted' },
			});
			expect(hookResult.getThenReads()).toBe(1);
		});

		it('handles sync hooks returning values', () => {
			const hook = jest.fn().mockReturnValue({
				artifact: { artifact: 'sync' },
			});
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'sync-hook',
					lifecycle: 'after-fragments',
					hook,
				},
			];

			const result = runExtensionHooks(
				hooks,
				'after-fragments',
				{ artifact: { artifact: 'initial' } } as any,
				() => {}
			);

			expect(result).toEqual({
				artifact: { artifact: 'sync' },
				results: [
					{
						hook: hooks[0],
						result: { artifact: { artifact: 'sync' } },
					},
				],
			});
		});

		it('snapshots commit and rollback callbacks when hook work is admitted', async () => {
			const originalCommit = jest.fn();
			const originalRollback = jest.fn();
			const replacementCommit = jest.fn();
			const replacementRollback = jest.fn();
			const hookResult = {
				artifact: { artifact: 'admitted' },
				commit: originalCommit,
				rollback: originalRollback,
			};
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'snapshot-hook',
					lifecycle: 'after-fragments',
					hook: () => hookResult,
				},
			];

			const execution = await runExtensionHooks(
				hooks,
				'after-fragments',
				{ artifact: { artifact: 'initial' } } as any,
				() => undefined
			);
			hookResult.commit = replacementCommit;
			hookResult.rollback = replacementRollback;

			await commitExtensionResults(execution.results);
			await rollbackExtensionResults(
				execution.results,
				hooks,
				() => undefined
			);

			expect(originalCommit).toHaveBeenCalledTimes(1);
			expect(originalRollback).toHaveBeenCalledTimes(1);
			expect(replacementCommit).not.toHaveBeenCalled();
			expect(replacementRollback).not.toHaveBeenCalled();
		});

		it('handles async hooks returning values', async () => {
			const hook = jest
				.fn()
				.mockResolvedValue({ artifact: { artifact: 'modified' } });
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'async-hook',
					lifecycle: 'after-fragments',
					hook,
				},
			];

			const result = await runExtensionHooks(
				hooks,
				'after-fragments',
				{ artifact: { artifact: 'initial' } } as any,
				() => {}
			);

			expect(result.artifact).toEqual({ artifact: 'modified' });
			expect(hook).toHaveBeenCalled();
		});

		it('handles hooks returning undefined (ignored)', async () => {
			const hook = jest.fn().mockReturnValue(undefined);
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'void-hook',
					lifecycle: 'after-fragments',
					hook,
				},
			];

			const result = await runExtensionHooks(
				hooks,
				'after-fragments',
				{ artifact: { artifact: 'initial' } } as any,
				() => {}
			);

			expect(result.artifact).toEqual({ artifact: 'initial' });
		});

		it('handles async hooks returning undefined (ignored)', async () => {
			const hook = jest.fn().mockResolvedValue(undefined);
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'async-void-hook',
					lifecycle: 'after-fragments',
					hook,
				},
			];

			const result = await runExtensionHooks(
				hooks,
				'after-fragments',
				{ artifact: { artifact: 'initial' } } as any,
				() => {}
			);

			expect(result.artifact).toEqual({ artifact: 'initial' });
		});

		it('handles async hooks returning result without artifact', async () => {
			const hook = jest.fn().mockResolvedValue({ rollback: jest.fn() });
			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					key: 'no-artifact-hook',
					lifecycle: 'after-fragments',
					hook,
				},
			];

			const result = await runExtensionHooks(
				hooks,
				'after-fragments',
				{ artifact: { artifact: 'initial' } } as any,
				() => {}
			);

			expect(result.artifact).toEqual({ artifact: 'initial' });
			expect(hook).toHaveBeenCalled();
		});

		it('rolls back previously executed hooks if a hook throws', async () => {
			const rollback1 = jest.fn();
			const hook1 = jest.fn().mockReturnValue({ rollback: rollback1 });
			const hook2 = jest.fn().mockImplementation(() => {
				throw new Error('boom');
			});

			const hooks: ExtensionHookEntry<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{ key: 'h1', lifecycle: 'after-fragments', hook: hook1 },
				{ key: 'h2', lifecycle: 'after-fragments', hook: hook2 },
			];

			const onRollbackError = jest.fn();

			await expect(async () => {
				await runExtensionHooks(
					hooks,
					'after-fragments',
					{ artifact: { artifact: 'init' } } as any,
					onRollbackError
				);
			}).rejects.toThrow('boom');

			expect(rollback1).toHaveBeenCalled();
		});
	});

	describe('rollbackExtensionResults', () => {
		it('ignores hook results without rollback work', () => {
			const hook = {
				key: 'no-rollback',
				lifecycle: 'after-fragments',
				hook: jest.fn(),
			};
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [{ hook, result: {} }];

			expect(
				rollbackExtensionResults(results, [hook], () => undefined)
			).toBeUndefined();
		});

		it('adopts rollback thenables through one then property read', async () => {
			const rollbackResult = observedThenable(undefined);
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hostile-rollback' } as any,
					result: { rollback: () => rollbackResult.promise },
				},
			];

			await rollbackExtensionResults(
				results,
				[{ key: 'hostile-rollback' } as any],
				() => undefined
			);

			expect(rollbackResult.getThenReads()).toBe(1);
		});

		it('handles async rollbacks', async () => {
			const rollback = jest.fn().mockResolvedValue(undefined);
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hook1' } as any,
					result: { rollback },
				},
			];

			await rollbackExtensionResults(
				results,
				[{ key: 'hook1' } as any],
				() => {}
			);

			expect(rollback).toHaveBeenCalled();
		});

		it('calls onRollbackError if rollback fails', async () => {
			const error = new Error('rollback fail');
			const rollback = jest.fn().mockRejectedValue(error);
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hook1' } as any,
					result: { rollback },
				},
			];

			const onRollbackError = jest.fn();

			await rollbackExtensionResults(
				results,
				[{ key: 'hook1' } as any],
				onRollbackError
			);

			expect(onRollbackError).toHaveBeenCalledWith(
				expect.objectContaining({
					error,
					extensionKeys: ['hook1'],
				})
			);
		});

		it('handles sync rollbacks', () => {
			const rollback = jest.fn();
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hook1' } as any,
					result: { rollback },
				},
			];

			const outcome = rollbackExtensionResults(
				results,
				[{ key: 'hook1' } as any],
				() => {}
			);

			expect(outcome).toBeUndefined();
			expect(rollback).toHaveBeenCalled();
		});
	});

	describe('commitExtensionResults', () => {
		it('adopts commit thenables through one then property read', async () => {
			const commitResult = observedThenable(undefined);
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hostile-commit' } as any,
					result: { commit: () => commitResult.promise },
				},
			];

			await commitExtensionResults(results);

			expect(commitResult.getThenReads()).toBe(1);
		});

		it('handles async commits', async () => {
			const commit = jest.fn().mockResolvedValue(undefined);
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hook1' } as any,
					result: { commit },
				},
			];

			await commitExtensionResults(results);

			expect(commit).toHaveBeenCalled();
		});

		it('handles sync commits', () => {
			const commit = jest.fn();
			const results: ExtensionHookExecution<
				TestContext,
				TestOptions,
				TestArtifact
			>[] = [
				{
					hook: { key: 'hook1' } as any,
					result: { commit },
				},
			];

			const outcome = commitExtensionResults(results);

			expect(outcome).toBeUndefined();
			expect(commit).toHaveBeenCalled();
		});
	});
});
