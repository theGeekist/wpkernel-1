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
			rollbackJournal: [],
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
			stages: () => [() => ({ __halt: true })],
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
				() => ({
					__halt: true,
					error,
					result: { artifact: { count: 9 } },
				}),
			],
		});
		const state = baseState(0);

		await expect(
			Promise.resolve().then(() =>
				executeRunWithPause(dependencies, baseRunContext(state))
			)
		).rejects.toBe(error);
	});
});
