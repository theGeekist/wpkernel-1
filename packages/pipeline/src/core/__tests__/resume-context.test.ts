import { prepareResumeContext } from '../runner/context';
import type {
	AgnosticRunnerDependencies,
	AgnosticState,
} from '../runner/types';
import type {
	PipelineDiagnostic,
	PipelinePauseSnapshot,
	PipelineReporter,
} from '../types';
import { createAgnosticDiagnosticManager } from '../runner/diagnostics';

describe('prepareResumeContext', () => {
	it('restores reporter and hook options from snapshot state', () => {
		const reporter: PipelineReporter = { warn: jest.fn() };
		const diagnosticManager = createAgnosticDiagnosticManager<
			PipelineReporter,
			PipelineDiagnostic
		>();
		const setReporter = jest.spyOn(diagnosticManager, 'setReporter');

		const state: AgnosticState<
			{ id: string },
			{ value: number },
			{ reporter: PipelineReporter },
			PipelineReporter,
			PipelineDiagnostic
		> = {
			context: { reporter },
			reporter,
			runOptions: { id: 'resume' },
			userState: { value: 42 },
			helperOrders: new Map(),
			extensionHooks: [],
			steps: [],
			diagnostics: [],
			diagnosticManager,
			executedLifecycles: new Set(),
			rollbackJournal: [],
			extensionStack: [],
			committedExtensionStates: new Set(),
		};

		const snapshot: PipelinePauseSnapshot<typeof state> = {
			stageIndex: 0,
			state,
			createdAt: Date.now(),
		};

		const dependencies: AgnosticRunnerDependencies<
			{ id: string },
			{ value: number },
			{ reporter: PipelineReporter },
			PipelineReporter,
			PipelineDiagnostic,
			unknown
		> = {
			options: {
				createContext: () => ({ reporter }),
				createState: () => ({ value: 0 }),
				createError: (_code, message) => new Error(message),
			},
			helperRegistries: new Map(),
			diagnosticManager,
			resolveRunResult: () => ({}),
			extensionHooks: [],
			stages: () => [],
		};

		const resumeContext = prepareResumeContext(dependencies, snapshot);
		const hookOptions = resumeContext.buildHookOptions(
			state,
			'resume-hook'
		);

		expect(setReporter).toHaveBeenCalledWith(reporter);
		expect(hookOptions.options).toEqual({ id: 'resume' });
		expect(hookOptions.artifact).toEqual({ value: 42 });
	});
});
