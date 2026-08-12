import { registerHelper, handleExtensionRegisterResult } from '../registration';
import type {
	Helper,
	PipelineReporter,
	PipelineExtensionHookRegistration,
} from '../types';
import type { RegisteredHelper } from '../dependency-graph';
import type { ExtensionHookEntry } from '../extensions';

type TestHelper = Helper<
	unknown,
	unknown,
	unknown,
	PipelineReporter,
	'fragment'
>;

describe('registration', () => {
	describe('registerHelper', () => {
		it('throws if helper kind does not match expected kind', () => {
			const helper = {
				key: 'h1',
				kind: 'builder',
			} as unknown as TestHelper;
			const entries: RegisteredHelper<TestHelper>[] = [];
			const createError = (_code: string, message: string) =>
				new Error(message);

			expect(() =>
				registerHelper(
					helper,
					'fragment',
					entries,
					'Fragment',
					() => {},
					createError
				)
			).toThrow(
				'Attempted to register helper "h1" as Fragment but received kind "builder".'
			);
		});

		it('throws if override conflict detected', () => {
			const helper = {
				key: 'h1',
				kind: 'fragment',
				mode: 'override',
				apply: () => undefined,
			} as unknown as TestHelper;
			const existing = {
				key: 'h1',
				kind: 'fragment',
				mode: 'override',
				apply: () => undefined,
			} as unknown as TestHelper;
			const entries: RegisteredHelper<TestHelper>[] = [
				{
					helper: existing,
					id: 'fragment:h1#0',
					index: 0,
				},
			];
			const onConflict = jest.fn();
			const createError = (_code: string, message: string) =>
				new Error(message);

			expect(() =>
				registerHelper(
					helper,
					'fragment',
					entries,
					'Fragment',
					onConflict,
					createError
				)
			).toThrow('Multiple overrides registered for helper "h1".');

			expect(onConflict).toHaveBeenCalledWith(
				helper,
				existing,
				'Multiple overrides registered for helper "h1".'
			);
		});

		it('rejects helpers without an apply function', () => {
			const entries: RegisteredHelper<TestHelper>[] = [];
			const createError = (_code: string, message: string) =>
				new Error(message);

			expect(() =>
				registerHelper(
					{
						key: 'invalid',
						kind: 'fragment',
						mode: 'extend',
						priority: 0,
						dependsOn: [],
						apply: undefined,
					} as unknown as TestHelper,
					'fragment',
					entries,
					'Fragment',
					() => undefined,
					createError
				)
			).toThrow('Helper "invalid" must provide an apply function.');
			expect(entries).toEqual([]);
		});
	});

	describe('handleExtensionRegisterResult', () => {
		it('assigns a stable anonymous hook key', () => {
			const hook = jest.fn();
			const hooks: ExtensionHookEntry<unknown, unknown, unknown>[] = [];

			handleExtensionRegisterResult(undefined, hook, hooks);

			expect(hooks[0]?.key).toBe('pipeline.extension#1');
		});

		it('registers function result as a hook', () => {
			const hook = jest.fn();
			const hooks: ExtensionHookEntry<unknown, unknown, unknown>[] = [];
			const key = 'ext1';

			handleExtensionRegisterResult(key, hook, hooks);

			expect(hooks).toHaveLength(1);
			expect(hooks[0]).toEqual(
				expect.objectContaining({
					key,
					hook,
					lifecycle: 'after-fragments', // Default
				})
			);
		});

		it('registers object result as a hook', () => {
			const hook = jest.fn();
			const result: PipelineExtensionHookRegistration<
				unknown,
				unknown,
				unknown
			> = {
				hook,
				lifecycle: 'before-builders',
			};
			const hooks: ExtensionHookEntry<unknown, unknown, unknown>[] = [];
			const key = 'ext1';

			handleExtensionRegisterResult(key, result, hooks);

			expect(hooks).toHaveLength(1);
			expect(hooks[0]).toEqual(
				expect.objectContaining({
					key,
					hook,
					lifecycle: 'before-builders',
				})
			);
		});

		it('returns non-hook result as is', () => {
			const result = { some: 'data' };
			const hooks: ExtensionHookEntry<unknown, unknown, unknown>[] = [];
			const key = 'ext1';

			const returned = handleExtensionRegisterResult(key, result, hooks);

			expect(hooks).toHaveLength(0);
			expect(returned).toBe(result);
		});
	});
});
