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

		const state: AgnosticState<
			TestOptions,
			TestState,
			TestContext,
			PipelineReporter,
			TestDiagnostic
		> = {
			context: { reporter: {} },
			reporter: {},
			runOptions: { id: 'run' },
			userState: { count: 2 },
			helperOrders: new Map(),
			steps: [],
			diagnostics: [],
			diagnosticManager: createAgnosticDiagnosticManager(),
			executedLifecycles: new Set(),
			helperRollbackStack: [],
			extensionStack: [extensionState],
			committedExtensionStates: new Set(),
		};

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

		const state: AgnosticState<
			TestOptions,
			TestState,
			TestContext,
			PipelineReporter,
			TestDiagnostic
		> = {
			context: { reporter: {} },
			reporter: {},
			runOptions: { id: 'run' },
			userState: { count: 9 },
			helperOrders: new Map(),
			steps: [],
			diagnostics: [],
			diagnosticManager: createAgnosticDiagnosticManager(),
			executedLifecycles: new Set(),
			helperRollbackStack: [],
			extensionStack: [],
			committedExtensionStates: new Set(),
		};

		const result = executeRunWithPause(dependencies, baseRunContext(state));

		expect(result).toEqual({ artifact: { count: 9 } });
	});
});
