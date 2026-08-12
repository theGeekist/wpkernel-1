import { makePipeline } from '../makePipeline';
import { createAgnosticStages } from '../runner/program';
import { prepareContext } from '../runner/context';
import { createAgnosticDiagnosticManager } from '../runner/diagnostics';
import type {
	AgnosticRunnerDependencies,
	AgnosticState,
	PipelineStage,
	Halt,
} from '../runner/types';
import type { Helper, PipelineReporter, PipelineDiagnostic } from '../types';
import type { RegisteredHelper } from '../dependency-graph';

describe('program coverage', () => {
	it('uses custom helper argument factories', async () => {
		const inputs: unknown[] = [];
		const reporter: PipelineReporter = { warn: jest.fn() };

		const pipeline = makePipeline({
			helperKinds: ['custom'],
			createContext: () => ({ reporter }),
			createState: () => ({}),
			createStages: (deps: any) => [
				deps.makeHelperStage('custom', {
					makeArgs:
						(state: { context: { reporter: PipelineReporter } }) =>
						() => ({
							context: state.context,
							input: 'from-create-helper-args',
							output: undefined,
							reporter: state.context.reporter,
						}),
				}),
				deps.finalizeResult,
			],
		});

		const helper: Helper<
			{ reporter: PipelineReporter },
			unknown,
			unknown,
			PipelineReporter,
			'custom'
		> = {
			key: 'custom-helper',
			kind: 'custom',
			mode: 'extend',
			priority: 1,
			dependsOn: [],
			apply: (args) => {
				inputs.push(args.input);
			},
		};

		pipeline.use(helper);

		await pipeline.run({});

		expect(inputs).toEqual(['from-create-helper-args']);
	});

	it('throws for invalid helper shapes', () => {
		const helperRegistries = new Map<string, RegisteredHelper<unknown>[]>();
		helperRegistries.set('test', [
			{
				id: 'test:bad#0',
				index: 0,
				helper: {
					key: 'bad',
					kind: 'test',
					mode: 'extend',
					priority: 1,
					dependsOn: [],
				},
			},
		]);

		const dependencies: AgnosticRunnerDependencies<
			Record<string, never>,
			Record<string, never>,
			{ reporter: PipelineReporter },
			PipelineReporter,
			PipelineDiagnostic,
			unknown
		> = {
			options: {
				createContext: () => ({ reporter: { warn: jest.fn() } }),
				createState: () => ({}),
				createError: (_code, message) => new Error(message),
			},
			helperRegistries,
			diagnosticManager: createAgnosticDiagnosticManager(),
			resolveRunResult: () => ({}),
			extensionHooks: [],
			stages: (deps) =>
				[deps.makeHelperStage('test')] as unknown as PipelineStage<
					AgnosticState<
						Record<string, never>,
						Record<string, never>,
						{ reporter: PipelineReporter },
						PipelineReporter,
						PipelineDiagnostic
					>,
					Halt<unknown>
				>[],
		};

		const runContext = prepareContext(dependencies, {});
		const stages = createAgnosticStages(dependencies, runContext);

		return Promise.resolve()
			.then(() => stages[0]?.(runContext.state))
			.then((result) => {
				expect(result).toMatchObject({
					__halt: true,
					error: expect.any(Error),
				});
				expect((result as { error?: Error }).error?.message).toContain(
					'Invalid helper: expected object with .apply method.'
				);
			});
	});

	it('supports helper stages for kinds with no registered order', async () => {
		const registeredHelpers: RegisteredHelper<unknown>[][] = [];
		const reporter: PipelineReporter = { warn: jest.fn() };
		const pipeline = makePipeline({
			helperKinds: [],
			createContext: () => ({ reporter }),
			createState: () => ({ value: 1 }),
			createStages: (deps: any) => {
				deps.diagnostics.flagUnusedHelper(
					{
						key: 'unused',
						kind: 'absent',
						mode: 'extend',
						priority: 0,
						dependsOn: [],
					},
					'absent',
					'not admitted'
				);
				return [
					deps.makeHelperStage('absent', {
						onVisited: (
							state: unknown,
							_visited: ReadonlySet<string>,
							registered: RegisteredHelper<unknown>[]
						) => {
							registeredHelpers.push(registered);
							return state;
						},
					}),
					deps.finalizeResult,
				];
			},
		});

		const result = await pipeline.run({});

		expect(registeredHelpers).toEqual([[]]);
		expect(result).toMatchObject({
			diagnostics: [
				expect.objectContaining({
					type: 'unused-helper',
					dependsOn: [],
				}),
			],
		});
	});

	it('defaults pause snapshots to the first stage', () => {
		let pause:
			| ((
					state: unknown,
					options?: { token?: unknown }
			  ) => { snapshot: { stageIndex: number; token?: unknown } })
			| undefined;
		const dependencies: AgnosticRunnerDependencies<
			Record<string, never>,
			Record<string, never>,
			{ reporter: PipelineReporter },
			PipelineReporter,
			PipelineDiagnostic,
			unknown
		> = {
			options: {
				createContext: () => ({ reporter: {} }),
				createState: () => ({}),
				createError: (_code, message) => new Error(message),
				supportsPause: true,
			},
			helperRegistries: new Map(),
			diagnosticManager: createAgnosticDiagnosticManager(),
			resolveRunResult: () => ({}),
			extensionHooks: [],
			stages: (deps) => {
				pause = deps.pause as typeof pause;
				return [];
			},
		};
		const runContext = prepareContext(dependencies, {});

		createAgnosticStages(dependencies, runContext);
		const { stageIndex: _stageIndex, ...stateWithoutStageIndex } =
			runContext.state;
		const paused = pause?.(stateWithoutStageIndex, { token: 'token' });

		expect(paused?.snapshot).toMatchObject({
			stageIndex: 0,
			token: 'token',
		});
	});
});
