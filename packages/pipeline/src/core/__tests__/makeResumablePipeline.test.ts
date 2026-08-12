import { makeResumablePipeline } from '../makeResumablePipeline';
import { createHelper } from '../helper';
import { createPipelineRollback } from '../rollback';
import type {
	PipelineDiagnostic,
	PipelinePaused,
	PipelineReporter,
	PipelineRunState,
	ResumablePipeline,
} from '../types';
import type { AgnosticState } from '../runner/types';

type PauseRunOptions = Record<string, never>;
type PauseUserState = { count: number };
type PauseContext = { reporter: PipelineReporter };
type PauseDiagnostic = PipelineDiagnostic;
type PausePipelineState = AgnosticState<
	PauseRunOptions,
	PauseUserState,
	PauseContext,
	PipelineReporter,
	PauseDiagnostic
>;
type PausePipeline = ResumablePipeline<
	PauseRunOptions,
	PipelineRunState<PauseUserState, PauseDiagnostic>,
	PauseContext,
	PipelineReporter,
	PausePipelineState
>;

describe('makeResumablePipeline', () => {
	const mockReporter: PipelineReporter = { warn: jest.fn() };
	const mockContext: PauseContext = { reporter: mockReporter };

	it('reports a settled extension registration failure to the next run', async () => {
		const registrationError = new Error('extension registration failed');
		const pipeline = makeResumablePipeline({
			helperKinds: [],
			createContext: () => mockContext,
			createState: () => ({}),
		});

		const registration = pipeline.extensions.use({
			key: 'failing-extension',
			register: async () => {
				throw registrationError;
			},
		});

		await expect(registration).rejects.toBe(registrationError);
		await expect(
			Promise.resolve().then(() => pipeline.run({}))
		).rejects.toBe(registrationError);
		expect(pipeline.run({})).toMatchObject({ artifact: {} });
	});

	it('pauses and resumes with snapshot state', async () => {
		const pipeline: PausePipeline = makeResumablePipeline<
			PauseRunOptions,
			PauseContext,
			PipelineReporter,
			PauseUserState,
			PauseDiagnostic
		>({
			helperKinds: [],
			createContext: () => mockContext,
			createState: () => ({ count: 0 }),
			createStages: (deps: any) => [
				(state: any) => {
					if (!deps.pause) {
						throw new Error('pause not available');
					}
					if (!state.resumeInput) {
						return deps.pause(state, {
							pauseKind: 'test',
							payload: { step: 'first' },
						});
					}

					return {
						...state,
						userState: { count: state.userState.count + 1 },
					};
				},
				deps.finalizeResult,
			],
		});

		const initial = await pipeline.run({});
		expect((initial as PipelinePaused<PausePipelineState>).__paused).toBe(
			true
		);

		const paused = initial as PipelinePaused<PausePipelineState>;
		expect(paused.snapshot.stageIndex).toBe(0);
		expect(paused.snapshot.pauseKind).toBe('test');
		expect(paused.snapshot.payload).toEqual({ step: 'first' });

		const resumed = await pipeline.resume(paused.snapshot, {
			resumed: true,
		});

		expect((resumed as PipelinePaused<unknown>).__paused).not.toBe(true);
		const result = resumed as PipelineRunState<{ count: number }>;
		expect(result.artifact.count).toBe(1);
	});

	it('retains live object identity across process-local suspension', async () => {
		const liveHandle = new Map([['status', 'open']]);
		const pipeline = makeResumablePipeline({
			helperKinds: [],
			createContext: () => mockContext,
			createState: () => ({ liveHandle }),
			createStages: (deps: any) => [
				(state: any) =>
					state.resumeInput
						? state
						: deps.pause(state, { pauseKind: 'process-local' }),
				deps.finalizeResult,
			],
		});

		const paused = (await pipeline.run({})) as PipelinePaused<any>;
		expect(paused.snapshot.state.userState.liveHandle).toBe(liveHandle);

		const resumed = (await pipeline.resume(paused.snapshot, {
			continue: true,
		})) as PipelineRunState<{ liveHandle: typeof liveHandle }>;
		expect(resumed.artifact.liveHandle).toBe(liveHandle);
	});

	it('preserves helper rollbacks while paused and unwinds them on a later resumed failure', async () => {
		const rollback = jest.fn();
		const pipeline: PausePipeline = makeResumablePipeline<
			PauseRunOptions,
			PauseContext,
			PipelineReporter,
			PauseUserState,
			PauseDiagnostic
		>({
			helperKinds: ['work'],
			createContext: () => mockContext,
			createState: () => ({ count: 0 }),
			createStages: (deps: any) => [
				deps.makeHelperStage('work'),
				(state: any) =>
					state.resumeInput
						? state
						: deps.pause(state, {
								pauseKind: 'test',
							}),
				() => {
					throw new Error('resumed stage failed');
				},
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

		const initial = await pipeline.run({});
		const paused = initial as PipelinePaused<PausePipelineState>;

		expect(paused.__paused).toBe(true);
		expect(rollback).not.toHaveBeenCalled();

		await expect(
			Promise.resolve().then(() =>
				pipeline.resume(paused.snapshot, { resumed: true })
			)
		).rejects.toThrow('resumed stage failed');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('unwinds helpers when an initial resumable run returns an error halt', async () => {
		const rollback = jest.fn();
		const error = new Error('initial run halted');
		const pipeline: PausePipeline = makeResumablePipeline<
			PauseRunOptions,
			PauseContext,
			PipelineReporter,
			PauseUserState,
			PauseDiagnostic
		>({
			helperKinds: ['work'],
			createContext: () => mockContext,
			createState: () => ({ count: 0 }),
			createStages: (deps: any) => [
				deps.makeHelperStage('work'),
				() => deps.halt(error),
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
		).rejects.toThrow('initial run halted');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('preserves an explicit undefined error halt in an initial resumable run', async () => {
		const rollback = jest.fn();
		const pipeline: PausePipeline = makeResumablePipeline<
			PauseRunOptions,
			PauseContext,
			PipelineReporter,
			PauseUserState,
			PauseDiagnostic
		>({
			helperKinds: ['work'],
			createContext: () => mockContext,
			createState: () => ({ count: 0 }),
			createStages: (deps: any) => [
				deps.makeHelperStage('work'),
				() => deps.halt(undefined),
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
		).rejects.toBeUndefined();
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('unwinds helpers when a resumed run returns an error halt', async () => {
		const rollback = jest.fn();
		const error = new Error('resumed run halted');
		const pipeline: PausePipeline = makeResumablePipeline<
			PauseRunOptions,
			PauseContext,
			PipelineReporter,
			PauseUserState,
			PauseDiagnostic
		>({
			helperKinds: ['work'],
			createContext: () => mockContext,
			createState: () => ({ count: 0 }),
			createStages: (deps: any) => [
				deps.makeHelperStage('work'),
				(state: PausePipelineState) =>
					state.resumeInput
						? deps.halt(error)
						: deps.pause(state, {
								pauseKind: 'test',
							}),
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

		const initial = await pipeline.run({});
		const paused = initial as PipelinePaused<PausePipelineState>;
		expect(rollback).not.toHaveBeenCalled();

		await expect(
			Promise.resolve().then(() =>
				pipeline.resume(paused.snapshot, { resumed: true })
			)
		).rejects.toThrow('resumed run halted');
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('preserves an undefined rejection from a resumed run', async () => {
		const rollback = jest.fn();
		const pipeline: PausePipeline = makeResumablePipeline<
			PauseRunOptions,
			PauseContext,
			PipelineReporter,
			PauseUserState,
			PauseDiagnostic
		>({
			helperKinds: ['work'],
			createContext: () => mockContext,
			createState: () => ({ count: 0 }),
			createStages: (deps: any) => [
				deps.makeHelperStage('work'),
				(state: PausePipelineState) =>
					state.resumeInput
						? Promise.reject()
						: deps.pause(state, {
								pauseKind: 'test',
							}),
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

		const initial = await pipeline.run({});
		const paused = initial as PipelinePaused<PausePipelineState>;

		await expect(
			Promise.resolve().then(() =>
				pipeline.resume(paused.snapshot, { resumed: true })
			)
		).rejects.toBeUndefined();
		expect(rollback).toHaveBeenCalledTimes(1);
	});
});
