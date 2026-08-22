import { makePipeline } from '../makePipeline';
import { createPipelineExtension } from '../createExtension';

describe('ignored extension lifecycles', () => {
	it('adopts setup thenables through one then property read', async () => {
		let thenReads = 0;
		const setupResult = Object.defineProperty({}, 'then', {
			get: () => {
				thenReads += 1;
				return (resolve: () => void) => resolve();
			},
		}) as unknown as Promise<void>;
		const hook = jest.fn();
		const extension = createPipelineExtension({
			setup: () => setupResult,
			hook,
		});

		await expect(extension.register({})).resolves.toBe(hook);
		expect(thenReads).toBe(1);
	});

	it('warns about ignored hooks for unscheduled lifecycles', async () => {
		const warnSpy = jest.fn();
		const pipeline = makePipeline({
			helperKinds: [],
			createStages: (deps: any) => [
				deps.makeLifecycleStage('fragment'), // Only schedule 'fragment' stage
				deps.finalizeResult,
			],
			createContext: () => ({
				reporter: {
					warn: warnSpy,
				},
			}),
			createState: () => ({}),
		});

		const hookSpy = jest.fn();

		// Register an extension for a lifecycle that is NOT scheduled
		pipeline.extensions.use(
			createPipelineExtension({
				key: 'ignored-ext',
				lifecycle: 'custom-lifecycle',
				hook: () => {
					hookSpy();
				},
			})
		);

		await pipeline.run({});

		// 1. Verify the hook did NOT run (confirming it was ignored)
		expect(hookSpy).not.toHaveBeenCalled();

		// 2. Verify warning WAS logged (confirming fix)
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The following extension hooks will be ignored'
			)
		);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('"custom-lifecycle"')
		);
	});

	it('does not let ignored-lifecycle reporter failures change the run result', () => {
		const reporterFailure = new Error('reporter failed');
		const pipeline = makePipeline({
			helperKinds: [],
			createStages: (deps: any) => [deps.finalizeResult],
			createContext: () => ({
				reporter: {
					warn: () => {
						throw reporterFailure;
					},
				},
			}),
			createState: () => ({}),
		});

		pipeline.extensions.use(
			createPipelineExtension({
				key: 'ignored-ext',
				lifecycle: 'custom-lifecycle',
				hook: jest.fn(),
			})
		);

		expect(pipeline.run({})).toBeDefined();
	});

	it('handles async extension registration', async () => {
		const warnSpy = jest.fn();
		const pipeline = makePipeline({
			helperKinds: [],
			createStages: (deps: any) => [deps.finalizeResult],
			createContext: () => ({
				reporter: {
					warn: warnSpy,
				},
			}),
			createState: () => ({}),
		});

		const hookSpy = jest.fn();

		// Register an extension with async register
		const extension = createPipelineExtension({
			key: 'async-ignored-ext',
			lifecycle: 'custom-lifecycle',
			hook: () => {
				hookSpy();
			},
		});

		await pipeline.extensions.use({
			...extension,
			register: async (p) => {
				await Promise.resolve();
				return extension.register(p);
			},
		});

		await pipeline.run({});

		expect(hookSpy).not.toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'The following extension hooks will be ignored'
			)
		);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('"custom-lifecycle"')
		);
	});
});
