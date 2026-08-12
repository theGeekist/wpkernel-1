import { makePipeline } from '../makePipeline';
import { createHelper } from '../helper';
import { type PipelineStage } from '../runner/types';
import type { PipelineReporter } from '../types';

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((next) => {
		resolve = next;
	});
	return { promise, resolve };
};

describe('makePipeline', () => {
	const mockReporter: PipelineReporter = { warn: jest.fn() };
	const mockContext = { reporter: mockReporter };

	// Minimal options for makePipeline
	const baseOptions = {
		helperKinds: ['testHelper'],
		createContext: () => mockContext,
		createState: () => ({}),
	};

	it('should support custom stages', async () => {
		const customStageSpy = jest.fn();

		// Custom stage that just passes state through
		const customStage: PipelineStage<any, any> = (state) => {
			customStageSpy('executing');
			return state;
		};

		const pipeline = makePipeline({
			...baseOptions,
			createStages: (deps: any) => {
				const { makeHelperStage, finalizeResult } = deps;
				// Compose custom stage between helper and finalize stages
				return [
					makeHelperStage('testHelper'),
					customStage,
					finalizeResult,
				];
			},
		});

		await pipeline.run({});

		expect(customStageSpy).toHaveBeenCalledWith('executing');
	});

	it('should allow accessing default stages via deps', async () => {
		const pipeline = makePipeline({
			...baseOptions,
			createStages: (deps: any) => {
				// Assert that standard stages are available
				expect(deps.makeHelperStage).toBeDefined();
				expect(deps.finalizeResult).toBeDefined();
				return [deps.finalizeResult]; // minimal valid stack for this test
			},
		});

		await pipeline.run({});
	});

	it('should support extension lifecycles configuration', async () => {
		const pipeline = makePipeline({
			...baseOptions,
			extensions: {
				lifecycles: ['custom-lifecycle'],
			},
			createStages: (deps: any) => {
				const { makeLifecycleStage, finalizeResult } = deps;
				return [makeLifecycleStage('custom-lifecycle'), finalizeResult];
			},
		});

		// We can't easily spy on internal lifecycle execution without an extension
		// But verifying it runs without error suggests the configuration was accepted.
		const result = await pipeline.run({});
		expect(result).toMatchObject({ artifact: {} });
	});

	it('returns flattened public pipeline steps', async () => {
		const pipeline = makePipeline({
			...baseOptions,
		});
		pipeline.use(
			createHelper({
				key: 'step',
				kind: 'testHelper',
				priority: 7,
				dependsOn: [],
				origin: 'test',
				apply() {},
			})
		);

		const result = await pipeline.run({});

		expect(result.steps).toEqual([
			{
				key: 'step',
				kind: 'testHelper',
				mode: 'extend',
				priority: 7,
				dependsOn: [],
				origin: 'test',
				id: 'testHelper:step#0',
				index: 0,
			},
		]);
		expect(result.steps[0]).not.toHaveProperty('helper');
		expect(result.steps[0]).not.toHaveProperty('apply');
	});

	it('uses one immutable registration snapshot for each run', async () => {
		const gate = deferred();
		const firstHook = jest.fn();
		const laterHook = jest.fn();
		const pipeline = makePipeline({
			...baseOptions,
			createStages: (deps: any) => [
				(state: unknown) => gate.promise.then(() => state),
				deps.makeLifecycleStage('after-fragments'),
				deps.finalizeResult,
			],
		});

		pipeline.extensions.use({
			key: 'first',
			register: () => firstHook,
		});
		const firstRun = pipeline.run({});

		pipeline.extensions.use({
			key: 'later',
			register: () => laterHook,
		});
		gate.resolve();
		await firstRun;

		expect(firstHook).toHaveBeenCalledTimes(1);
		expect(laterHook).not.toHaveBeenCalled();

		await pipeline.run({});
		expect(firstHook).toHaveBeenCalledTimes(2);
		expect(laterHook).toHaveBeenCalledTimes(1);
	});

	it('waits for extension registration to become quiescent before preparing a run', async () => {
		const first = deferred();
		const second = deferred();
		const firstHook = jest.fn();
		const secondHook = jest.fn();
		const pipeline = makePipeline({
			...baseOptions,
			createStages: (deps: any) => [
				deps.makeLifecycleStage('after-fragments'),
				deps.finalizeResult,
			],
		});

		const firstRegistration = pipeline.extensions.use({
			key: 'first',
			register: async () => {
				await first.promise;
				return firstHook;
			},
		});
		let runSettled = false;
		const run = Promise.resolve(pipeline.run({})).then((result) => {
			runSettled = true;
			return result;
		});
		const secondRegistration = pipeline.extensions.use({
			key: 'second',
			register: async () => {
				await second.promise;
				return secondHook;
			},
		});

		first.resolve();
		await firstRegistration;
		await Promise.resolve();
		expect(runSettled).toBe(false);
		expect(firstHook).not.toHaveBeenCalled();

		second.resolve();
		await Promise.all([secondRegistration, run]);
		expect(firstHook).toHaveBeenCalledTimes(1);
		expect(secondHook).toHaveBeenCalledTimes(1);
	});

	it('keeps an asynchronous extension registration failure attached to the pipeline', async () => {
		const registrationError = new Error('extension registration failed');
		const pipeline = makePipeline(baseOptions);

		const registration = pipeline.extensions.use({
			key: 'failing-extension',
			register: async () => {
				throw registrationError;
			},
		});

		await expect(registration).rejects.toBe(registrationError);
		const runs = await Promise.allSettled([
			Promise.resolve().then(() => pipeline.run({})),
			Promise.resolve().then(() => pipeline.run({})),
		]);
		expect(runs).toEqual([
			{ status: 'rejected', reason: registrationError },
			{ status: 'rejected', reason: registrationError },
		]);
		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toBe(registrationError);
	});

	it('keeps a synchronous extension registration failure attached to the pipeline', () => {
		const registrationError = new Error('extension registration failed');
		const pipeline = makePipeline(baseOptions);

		expect(() =>
			pipeline.extensions.use({
				key: 'failing-extension',
				register: () => {
					throw registrationError;
				},
			})
		).toThrow(registrationError);
		expect(() => pipeline.run({})).toThrow(registrationError);
		expect(() => pipeline.run({})).toThrow(registrationError);
	});

	it('rejects helpers outside the configured helper kinds', () => {
		const pipeline = makePipeline(baseOptions);

		expect(() =>
			pipeline.use({
				key: 'unknown',
				kind: 'unknown',
				mode: 'extend',
				priority: 0,
				dependsOn: [],
				apply: () => undefined,
			})
		).toThrow('Helper kind "unknown" is not configured for this pipeline.');
	});
});
