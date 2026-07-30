import { makePipeline } from '../makePipeline';
import { createHelper } from '../helper';
import { type PipelineStage } from '../runner/types';
import type { PipelineReporter } from '../types';

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
});
