import { executeRunWithPause } from '../runner/execution';
import type {
	AgnosticRunContext,
	AgnosticRunnerDependencies,
	AgnosticState,
	Halt,
	PipelineStage,
} from '../runner/types';
import type { PipelineDiagnostic, PipelineReporter } from '../types';
import { createAgnosticDiagnosticManager } from '../runner/diagnostics';
import { rollbackJournalState } from '../runner/state';

describe('execution coverage', () => {
	type TestOptions = { id: string };
	type TestState = { count: number };
	type TestContext = { reporter: PipelineReporter };
	type TestDiagnostic = PipelineDiagnostic;
	type TestRunResult = { artifact: TestState };

	const baseDependencies = (
		overrides?: Partial<
			AgnosticRunnerDependencies<
				TestOptions,
				TestState,
				TestContext,
				PipelineReporter,
				TestDiagnostic,
				TestRunResult
			>
		>
	): AgnosticRunnerDependencies<
		TestOptions,
		TestState,
		TestContext,
		PipelineReporter,
		TestDiagnostic,
		TestRunResult
	> => ({
		options: {
			createContext: () => ({ reporter: {} }),
			createState: () => ({ count: 0 }),
			createError: (_code, message) => new Error(message),
		},
		helperRegistries: new Map(),
		diagnosticManager: createAgnosticDiagnosticManager(),
		resolveRunResult: ({ userState }) => ({ artifact: userState }),
		extensionHooks: [],
		stages: () => [],
		...overrides,
	});

	const baseRunContext = (
		state: AgnosticState<
			TestOptions,
			TestState,
			TestContext,
			PipelineReporter,
			TestDiagnostic
		>
	): AgnosticRunContext<
		TestOptions,
		TestState,
		TestContext,
		PipelineReporter,
		TestDiagnostic
	> => ({
		state,
		pushStep: () => undefined,
		buildHookOptions: () => ({
			context: state.context,
			options: { id: 'run' },
			artifact: state.userState,
			lifecycle: 'after-fragments',
		}),
	});

	const baseState = (
		count: number,
		overrides: Partial<
			AgnosticState<
				TestOptions,
				TestState,
				TestContext,
				PipelineReporter,
				TestDiagnostic
			>
		> = {}
	): AgnosticState<
		TestOptions,
		TestState,
		TestContext,
		PipelineReporter,
		TestDiagnostic
	> => {
		const context = { reporter: {} };
		return {
			context,
			reporter: context.reporter,
			runOptions: { id: 'run' },
			userState: { count },
			helperOrders: new Map(),
			extensionHooks: [],
			steps: [],
			diagnostics: [],
			diagnosticManager: createAgnosticDiagnosticManager(),
			executedLifecycles: new Set(),
			[rollbackJournalState]: [],
			extensionStack: [],
			committedExtensionStates: new Set(),
			...overrides,
		};
	};

	it('commits extension stack when present', async () => {
		const commit = jest.fn();
		const stages: PipelineStage<
			AgnosticState<
				TestOptions,
				TestState,
				TestContext,
				PipelineReporter,
				TestDiagnostic
			>,
			Halt<TestRunResult>
		>[] = [(state) => state];

		const dependencies = baseDependencies({
			stages: () => stages,
		});

		const hook = {
			key: 'commit-hook',
			lifecycle: 'after-fragments' as const,
			hook: () => undefined,
		};
		const extensionState = {
			artifact: { count: 0 },
			results: [{ hook, result: { commit } }],
			hooks: [hook],
		};

		const state = baseState(2, { extensionStack: [extensionState] });

		const result = await executeRunWithPause(
			dependencies,
			baseRunContext(state)
		);

		expect(result).toEqual({ artifact: { count: 2 } });
		expect(commit).toHaveBeenCalled();
	});

	it('handles sync halt results', () => {
		const stages: PipelineStage<
			AgnosticState<
				TestOptions,
				TestState,
				TestContext,
				PipelineReporter,
				TestDiagnostic
			>,
			Halt<TestRunResult>
		>[] = [
			() => ({
				__halt: true,
				result: { artifact: { count: 9 } },
			}),
		];

		const dependencies = baseDependencies({
			stages: () => stages,
		});

		const state = baseState(9);

		const result = executeRunWithPause(dependencies, baseRunContext(state));

		expect(result).toEqual({ artifact: { count: 9 } });
	});

	it('preserves the established undefined result for a bare halt', () => {
		const dependencies = baseDependencies({
			stages: () => [
				() => ({ __halt: true }) as unknown as Halt<TestRunResult>,
			],
		});
		const state = baseState(0);

		expect(
			executeRunWithPause(dependencies, baseRunContext(state))
		).toBeUndefined();
	});

	it('gives an explicit error precedence over a simultaneous result', async () => {
		const error = new Error('halt failed');
		const dependencies = baseDependencies({
			stages: () => [
				() =>
					({
						__halt: true,
						error,
						result: { artifact: { count: 9 } },
					}) as unknown as Halt<TestRunResult>,
			],
		});
		const state = baseState(0);

		await expect(
			Promise.resolve().then(() =>
				executeRunWithPause(dependencies, baseRunContext(state))
			)
		).rejects.toBe(error);
	});

	it('rolls back when a fulfilled stage result cannot be adopted', async () => {
		const error = new Error('state adoption failed');
		const rollback = jest.fn();
		const dependencies = baseDependencies({
			stages: () => [
				(state) => {
					const result = { ...state };
					Object.defineProperty(result, 'userState', {
						enumerable: true,
						get: () => {
							throw error;
						},
					});
					return result;
				},
			],
		});
		const state = baseState(0, {
			[rollbackJournalState]: [
				{
					source: 'helper',
					entries: [
						{
							helper: { key: 'acquired' },
							rollback: { run: rollback },
						},
					],
				},
			],
		});

		await expect(
			Promise.resolve().then(() =>
				executeRunWithPause(dependencies, baseRunContext(state))
			)
		).rejects.toBe(error);
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('does not trust public halt objects to attest that rollback ran', async () => {
		const error = new Error('halt failed');
		const rollback = jest.fn();
		const dependencies = baseDependencies({
			stages: () => [
				() => ({
					__halt: true,
					error,
					__rollbackApplied: true,
				}),
			],
		});
		const state = baseState(0, {
			[rollbackJournalState]: [
				{
					source: 'helper',
					entries: [
						{
							helper: { key: 'acquired' },
							rollback: { run: rollback },
						},
					],
				},
			],
		});

		await expect(
			Promise.resolve().then(() =>
				executeRunWithPause(dependencies, baseRunContext(state))
			)
		).rejects.toBe(error);
		expect(rollback).toHaveBeenCalledTimes(1);
	});

	it('settles asynchronous rollback before rejecting a synchronous error halt', async () => {
		const error = new Error('halt failed');
		let releaseRollback: (() => void) | undefined;
		const rollbackGate = new Promise<void>((resolve) => {
			releaseRollback = resolve;
		});
		const rollback = jest.fn(() => rollbackGate);
		const dependencies = baseDependencies({
			stages: () => [() => ({ __halt: true, error })],
		});
		const state = baseState(0, {
			[rollbackJournalState]: [
				{
					source: 'helper',
					entries: [
						{
							helper: { key: 'acquired' },
							rollback: { run: rollback },
						},
					],
				},
			],
		});
		const settled = jest.fn();
		const outcome = Promise.resolve(
			executeRunWithPause(dependencies, baseRunContext(state))
		).catch((failure) => {
			settled();
			throw failure;
		});

		await Promise.resolve();
		expect(rollback).toHaveBeenCalledTimes(1);
		expect(settled).not.toHaveBeenCalled();

		releaseRollback?.();
		await expect(outcome).rejects.toBe(error);
		expect(settled).toHaveBeenCalledTimes(1);
	});

	it('continues when adopting a synchronous stage result reveals a thenable state', async () => {
		let thenAccessorReads = 0;
		const secondStage = jest.fn((state) => ({
			...state,
			userState: { count: state.userState.count + 1 },
		}));
		const dependencies = baseDependencies({
			stages: () => [
				(state) => {
					const result = { ...state };
					Object.defineProperty(result, 'then', {
						enumerable: true,
						get: () => {
							thenAccessorReads += 1;
							return (resolve: (value: typeof state) => void) =>
								resolve({
									...state,
									userState: { count: 4 },
								});
						},
					});
					return result;
				},
				secondStage,
			],
		});

		await expect(
			executeRunWithPause(dependencies, baseRunContext(baseState(0)))
		).resolves.toEqual({ artifact: { count: 5 } });
		expect(thenAccessorReads).toBe(1);
		expect(secondStage).toHaveBeenCalledTimes(1);
	});

	it('returns a pause revealed while adopting a synchronous stage result', async () => {
		const secondStage = jest.fn((state) => state);
		const dependencies = baseDependencies({
			stages: () => [
				(state) => {
					const result = { ...state };
					Object.defineProperty(result, 'then', {
						enumerable: true,
						get:
							() =>
							(
								resolve: (value: {
									readonly __paused: true;
									readonly snapshot: {
										readonly stageIndex: number;
										readonly state: typeof state;
										readonly createdAt: number;
									};
								}) => void
							) =>
								resolve({
									__paused: true,
									snapshot: {
										stageIndex: 0,
										state: {
											...state,
											userState: { count: 7 },
										},
										createdAt: Date.now(),
									},
								}),
					});
					return result;
				},
				secondStage,
			],
		});

		const result = await executeRunWithPause(
			dependencies,
			baseRunContext(baseState(0))
		);

		expect(result).toMatchObject({
			__paused: true,
			snapshot: { state: { userState: { count: 7 } } },
		});
		expect(secondStage).not.toHaveBeenCalled();
	});
});
