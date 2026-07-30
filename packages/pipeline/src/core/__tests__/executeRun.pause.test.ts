import { makePipeline } from '../makePipeline';
import { createHelper } from '../helper';
import { createPipelineRollback } from '../rollback';
import type { PipelinePaused } from '../types';

describe('executeRun pause handling', () => {
	it('throws when a non-resumable pipeline returns a paused result', async () => {
		const pipeline = makePipeline({
			helperKinds: [],
			createContext: () => ({ reporter: {} }),
			createState: () => ({}),
			createStages: (_deps: any) => [
				(state: any) =>
					({
						__paused: true,
						snapshot: {
							stageIndex: 0,
							state,
							createdAt: Date.now(),
						},
					}) as PipelinePaused<typeof state>,
			],
		});

		expect(() => pipeline.run({})).toThrow(
			'Pipeline paused during executeRun'
		);
	});

	it('rolls back completed helpers when a non-resumable pipeline pauses', async () => {
		const rollback = jest.fn();
		const pipeline = makePipeline({
			helperKinds: ['work'],
			createContext: () => ({ reporter: {} }),
			createState: () => ({}),
			createStages: (deps: any) => [
				deps.makeHelperStage('work'),
				(state: any) =>
					({
						__paused: true,
						snapshot: {
							stageIndex: 1,
							state,
							createdAt: Date.now(),
						},
					}) as PipelinePaused<unknown>,
			],
		});

		pipeline.use(
			createHelper({
				key: 'work.with-rollback',
				kind: 'work',
				apply() {
					return {
						rollback: createPipelineRollback(rollback),
					};
				},
			})
		);

		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toThrow('Pipeline paused during executeRun');
		expect(rollback).toHaveBeenCalledTimes(1);
	});
});
