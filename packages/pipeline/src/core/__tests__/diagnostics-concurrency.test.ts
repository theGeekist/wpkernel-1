import { makePipeline } from '../makePipeline';
import { makeResumablePipeline } from '../makeResumablePipeline';
import { createHelper } from '../helper';
import { createAgnosticDiagnosticManager } from '../runner/diagnostics';
import type {
	PipelineDiagnostic,
	PipelinePaused,
	PipelineReporter,
} from '../types';

type RunOptions = {
	readonly id: string;
	readonly fail?: boolean;
};

const createDiagnostic = (id: string): PipelineDiagnostic => ({
	type: 'unused-helper',
	key: id,
	helper: id,
	message: `diagnostic:${id}`,
	dependsOn: [],
});

describe('run-local diagnostics', () => {
	it('exposes diagnostics recorded before a run reporter exists', () => {
		const manager = createAgnosticDiagnosticManager();
		const diagnostic = createDiagnostic('configuration');

		manager.record(diagnostic);

		expect(manager.getDiagnostics()).toEqual([diagnostic]);
	});

	it('contains diagnostic observer failures', async () => {
		const diagnostic = createDiagnostic('observed');
		const pipeline = makePipeline({
			helperKinds: [],
			createContext: () => ({ reporter: {} }),
			createState: () => ({}),
			createStages: (deps: any) => [
				(state: unknown) => {
					deps.diagnostics.record(diagnostic);
					return state;
				},
				deps.finalizeResult,
			],
			onDiagnostic: () => {
				throw new Error('observer failed');
			},
		});

		await expect(Promise.resolve(pipeline.run({}))).resolves.toMatchObject({
			diagnostics: [diagnostic],
		});
	});

	it('isolates overlapping success and failure runs and their reporters', async () => {
		const releases = new Map<string, () => void>();
		const observed: Array<{ reporter: string; diagnostic: string }> = [];
		const pipeline = makePipeline({
			helperKinds: [],
			createContext: ({ id }: RunOptions) => ({
				reporter: {
					id,
					warn: jest.fn(),
				},
			}),
			createState: () => ({}),
			createStages: (deps: any) => [
				(state: any) =>
					new Promise<typeof state>((resolve, reject) => {
						releases.set(state.runOptions.id, () => {
							deps.diagnostics.record(
								createDiagnostic(state.runOptions.id)
							);
							if (state.runOptions.fail) {
								reject(
									new Error(`failed:${state.runOptions.id}`)
								);
								return;
							}
							resolve(state);
						});
					}),
				deps.finalizeResult,
			],
			createRunResult: ({ diagnostics }) => diagnostics,
			onDiagnostic: ({ reporter, diagnostic }) => {
				observed.push({
					reporter: (reporter as { id: string }).id,
					diagnostic: diagnostic.key,
				});
			},
		});

		const failedRun = Promise.resolve(
			pipeline.run({ id: 'failed', fail: true })
		);
		const successfulRun = Promise.resolve(
			pipeline.run({ id: 'successful' })
		);

		releases.get('successful')?.();
		const successfulDiagnostics = await successfulRun;
		releases.get('failed')?.();

		await expect(failedRun).rejects.toThrow('failed:failed');
		expect(successfulDiagnostics.map((entry) => entry.key)).toEqual([
			'successful',
		]);
		expect(observed).toEqual([
			{ reporter: 'successful', diagnostic: 'successful' },
			{ reporter: 'failed', diagnostic: 'failed' },
		]);
	});

	it('keeps diagnostics isolated in independent pause snapshots', async () => {
		const pipeline = makeResumablePipeline({
			helperKinds: [],
			createContext: ({ id }: RunOptions) => ({
				reporter: {
					id,
					warn: jest.fn(),
				} satisfies PipelineReporter & { readonly id: string },
			}),
			createState: () => ({}),
			createStages: (deps: any) => [
				(state: any) => {
					deps.diagnostics.record(
						createDiagnostic(state.runOptions.id)
					);
					return deps.pause(state, {
						pauseKind: 'diagnostics',
					});
				},
			],
		});

		const first = (await pipeline.run({
			id: 'first',
		})) as PipelinePaused<any>;
		const second = (await pipeline.run({
			id: 'second',
		})) as typeof first;

		expect(
			first.snapshot.state.diagnostics.map(
				(entry: PipelineDiagnostic) => entry.key
			)
		).toEqual(['first']);
		expect(
			second.snapshot.state.diagnostics.map(
				(entry: PipelineDiagnostic) => entry.key
			)
		).toEqual(['second']);
	});

	it('copies registration diagnostics into pause snapshots', async () => {
		const pipeline = makeResumablePipeline({
			helperKinds: ['work'],
			createContext: () => ({
				reporter: { warn: jest.fn() },
			}),
			createState: () => ({}),
			createStages: (deps: any) => [
				(state: any) =>
					deps.pause(state, {
						pauseKind: 'registration-diagnostics',
					}),
			],
		});
		const override = () =>
			createHelper({
				key: 'work.conflict',
				kind: 'work',
				mode: 'override',
				apply() {},
			});

		pipeline.use(override());
		expect(() => pipeline.use(override())).toThrow();

		const paused = (await pipeline.run({})) as PipelinePaused<any>;
		expect(paused.snapshot.state.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'conflict',
					key: 'work.conflict',
				}),
			])
		);
	});
});
