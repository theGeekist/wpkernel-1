import {
	createHelpersProgram,
	makeCommitStage,
	makeGuardedStage,
	makeHelperStageFactory,
} from '../runner/stage-factories';
import type {
	Helper,
	HelperApplyOptions,
	PipelinePaused,
	PipelineReporter,
} from '../types';
import type { PipelineRollback } from '../rollback';
import type { RegisteredHelper } from '../dependency-graph';
import type { Halt } from '../runner/types';
import { rollbackJournalState } from '../runner/state';

describe('stage-factories coverage', () => {
	it('createHelpersProgram handles missing rollback registration', async () => {
		const helper: Helper<unknown, unknown, unknown, PipelineReporter> = {
			key: 'h1',
			kind: 'test',
			mode: 'extend',
			priority: 1,
			dependsOn: [],
			apply: (_args, next) => {
				next?.();
			},
		};
		const entries: RegisteredHelper<typeof helper>[] = [
			{ helper, id: 'test:h1#0', index: 0 },
		];
		const steps: string[] = [];
		const program = createHelpersProgram({
			getOrder: () => entries,
			makeArgs: () => () =>
				({
					context: {},
					input: undefined,
					output: undefined,
					reporter: {},
				}) as HelperApplyOptions<
					unknown,
					unknown,
					unknown,
					PipelineReporter
				>,
			invoke: ({ helper: invokeHelper, args, next }) =>
				invokeHelper.apply(args, next) as unknown as void,
			recordStep: (entry) => steps.push(entry.id),
			onVisited: (state, visited) => {
				steps.push(`visited:${visited.size}`);
				return state;
			},
		});

		const result = await program({ count: 1 });
		expect(result).toEqual({ count: 1 });
		expect(steps).toEqual(['test:h1#0', 'visited:1']);
	});

	it('createHelpersProgram returns sync result when handlers are sync', () => {
		const helper: Helper<unknown, unknown, unknown, PipelineReporter> = {
			key: 'h-sync',
			kind: 'sync',
			mode: 'extend',
			priority: 1,
			dependsOn: [],
			apply: () => undefined,
		};
		const entries: RegisteredHelper<typeof helper>[] = [
			{ helper, id: 'sync:h-sync#0', index: 0 },
		];
		const program = createHelpersProgram({
			getOrder: () => entries,
			makeArgs: () => () =>
				({
					context: {},
					input: undefined,
					output: undefined,
					reporter: {},
				}) as HelperApplyOptions<
					unknown,
					unknown,
					unknown,
					PipelineReporter
				>,
			invoke: ({ helper: invokeHelper, args, next }) =>
				invokeHelper.apply(args, next) as unknown as void,
			recordStep: () => undefined,
			onVisited: (state) => state,
		});

		const result = program({ count: 1 });
		expect(result && typeof (result as Promise<unknown>).then).not.toBe(
			'function'
		);
	});

	it('createHelpersProgram registers rollbacks from async invocations', async () => {
		const rollback: PipelineRollback = {
			key: 'rb',
			run: () => undefined,
		};
		const helper: Helper<unknown, unknown, unknown, PipelineReporter> = {
			key: 'h2',
			kind: 'test',
			mode: 'extend',
			priority: 1,
			dependsOn: [],
			apply: (_args, next) => {
				next?.();
			},
		};
		const entries: RegisteredHelper<typeof helper>[] = [
			{ helper, id: 'test:h2#0', index: 0 },
		];
		const rollbacks: PipelineRollback[] = [];
		const program = createHelpersProgram({
			getOrder: () => entries,
			makeArgs: () => () =>
				({
					context: {},
					input: undefined,
					output: undefined,
					reporter: {},
				}) as HelperApplyOptions<
					unknown,
					unknown,
					unknown,
					PipelineReporter
				>,
			invoke: () =>
				Promise.resolve({ rollback }) as unknown as Promise<void>,
			recordStep: () => undefined,
			onVisited: (state) => state,
			registerRollback: (_helper, result) => {
				if (
					result &&
					typeof result === 'object' &&
					'rollback' in result
				) {
					rollbacks.push(
						(result as { rollback: PipelineRollback }).rollback
					);
				}
			},
		});

		await program({ count: 2 });
		expect(rollbacks).toEqual([rollback]);
	});

	it('makeCommitStage rolls back on commit error', async () => {
		const commitStage = makeCommitStage({
			isHalt: (value: unknown): value is Halt<unknown> =>
				Boolean(
					value && typeof value === 'object' && '__halt' in value
				),
			commit: () => {
				throw new Error('commit failed');
			},
			rollbackToHalt: (_state, error) => ({
				__halt: true,
				error,
			}),
		});

		const result = await commitStage({ count: 1 });
		expect(result).toEqual({
			__halt: true,
			error: expect.any(Error),
		});
	});

	it('makeHelperStageFactory short-circuits paused state', () => {
		const paused: PipelinePaused<{ value: number }> = {
			__paused: true,
			snapshot: {
				stageIndex: 0,
				state: { value: 1 },
				createdAt: Date.now(),
			},
		};
		const stageFactory = makeHelperStageFactory({
			pushStep: () => undefined,
			toRollbackContext: (state) => ({
				context: (state as any).context,
				[rollbackJournalState]: [],
			}),
			halt: () => ({ __halt: true, result: undefined }),
			isHalt: (value: unknown): value is Halt<unknown> =>
				Boolean(
					value && typeof value === 'object' && '__halt' in value
				),
		});

		const stage = stageFactory('test', {
			getOrder: () => [],
			makeArgs: () => () =>
				({
					context: {},
					input: undefined,
					output: undefined,
					reporter: {},
				}) as HelperApplyOptions<
					unknown,
					unknown,
					unknown,
					PipelineReporter
				>,
			onVisited: (state) => state,
		});

		const result = stage(paused as unknown as { value: number });
		expect(result).toBe(paused);
	});

	it('makeGuardedStage short-circuits halt state', () => {
		const halt: Halt<unknown> = { __halt: true, result: 'stopped' };
		const execute = jest.fn((state: { value: number }) => state);
		const stage = makeGuardedStage({
			isHalt: (value: unknown): value is Halt<unknown> =>
				Boolean(
					value && typeof value === 'object' && '__halt' in value
				),
			execute,
		});

		expect(stage(halt)).toBe(halt);
		expect(execute).not.toHaveBeenCalled();
	});

	it('uses the default helper invocation and admits declared rollbacks', () => {
		const rollback: PipelineRollback = {
			key: 'rollback',
			run: () => undefined,
		};
		const innerRollback: PipelineRollback = {
			key: 'inner-rollback',
			run: () => undefined,
		};
		const helpers: Helper<
			unknown,
			undefined,
			undefined,
			PipelineReporter
		>[] = [
			{
				key: 'with-rollback',
				kind: 'test',
				mode: 'extend',
				priority: 2,
				dependsOn: [],
				apply: (_args, next) => {
					void next?.();
					return { rollback };
				},
			},
			{
				key: 'without-rollback',
				kind: 'test',
				mode: 'extend',
				priority: 1,
				dependsOn: [],
				apply: () => ({ rollback: innerRollback }),
			},
			{
				key: 'without-rollback',
				kind: 'test',
				mode: 'extend',
				priority: 0,
				dependsOn: [],
				apply: () => ({ rollback: undefined }),
			},
			{
				key: 'without-rollback-property',
				kind: 'test',
				mode: 'extend',
				priority: -1,
				dependsOn: [],
				apply: () => ({}),
			},
		];
		const entries = helpers.map((helper, index) => ({
			helper,
			id: `test:${helper.key}#${index}`,
			index,
		}));
		const admitted: unknown[][] = [];
		const stageFactory = makeHelperStageFactory({
			pushStep: () => undefined,
			toRollbackContext: (state: { context: unknown }) => ({
				context: state.context,
				[rollbackJournalState]: [],
			}),
			halt: (error: unknown) => ({ __halt: true, error }),
			isHalt: (value: unknown): value is Halt<unknown> =>
				Boolean(
					value && typeof value === 'object' && '__halt' in value
				),
		});
		const stage = stageFactory('test', {
			getOrder: () => entries,
			makeArgs: (state: { context: unknown }) => () => ({
				context: state.context,
				input: undefined,
				output: undefined,
				reporter: {},
			}),
			writeRollbacks: (state, rollbacks) => {
				admitted.push([...rollbacks]);
				return state;
			},
			onVisited: (state, _visited, rollbacks) => {
				admitted.push([...rollbacks]);
				return state;
			},
		});
		const state = { context: {}, value: 1 };

		expect(stage(state)).toMatchObject(state);
		expect(admitted).toHaveLength(2);
		expect(admitted[0]).toEqual([
			{ helper: helpers[0], rollback },
			{ helper: helpers[1], rollback: innerRollback },
		]);
		expect(admitted[1]).toEqual(admitted[0]);
	});

	it('admits an empty helper stage without a rollback writer', () => {
		const stageFactory = makeHelperStageFactory({
			pushStep: () => undefined,
			toRollbackContext: (state: { context: unknown }) => ({
				context: state.context,
				[rollbackJournalState]: [],
			}),
			halt: (error: unknown) => ({ __halt: true, error }),
			isHalt: (value: unknown): value is Halt<unknown> =>
				Boolean(
					value && typeof value === 'object' && '__halt' in value
				),
		});
		const stage = stageFactory('empty', {
			getOrder: () => [],
			makeArgs: (state: { context: unknown }) => () => ({
				context: state.context,
				input: undefined,
				output: undefined,
				reporter: {},
			}),
			onVisited: (state) => state,
		});

		expect(stage({ context: {} })).toMatchObject({ context: {} });
	});

	it('makeHelperStageFactory short-circuits halt state', () => {
		const halt: Halt<unknown> = { __halt: true, result: 'stopped' };
		const getOrder = jest.fn(() => []);
		const stageFactory = makeHelperStageFactory({
			pushStep: () => undefined,
			toRollbackContext: () => ({
				context: {},
				[rollbackJournalState]: [],
			}),
			halt: () => halt,
			isHalt: (value: unknown): value is Halt<unknown> => value === halt,
		});
		const stage = stageFactory('test', {
			getOrder,
			makeArgs: () => () => ({
				context: {},
				input: undefined,
				output: undefined,
				reporter: {},
			}),
			onVisited: (state) => state,
		});

		expect(stage(halt)).toBe(halt);
		expect(getOrder).not.toHaveBeenCalled();
	});
});
