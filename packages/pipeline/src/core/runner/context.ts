import {
	createDependencyGraph,
	type RegisteredHelper,
} from '../dependency-graph';
import type {
	AgnosticRunContext,
	AgnosticRunnerDependencies,
	AgnosticState,
} from './types';
import type {
	PipelineReporter,
	PipelineDiagnostic,
	PipelineExtensionLifecycle,
	PipelinePauseSnapshot,
	PipelineStep,
	HelperDescriptor,
} from '../types';

/**
 * Prepares the pipeline execution context.
 *
 * @param dependencies
 * @param runOptions
 * @internal
 */
export const prepareContext = <
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
>(
	dependencies: AgnosticRunnerDependencies<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic,
		TRunResult
	>,
	runOptions: TRunOptions
): AgnosticRunContext<
	TRunOptions,
	TUserState,
	TContext,
	TReporter,
	TDiagnostic
> => {
	const context = dependencies.options.createContext(runOptions);

	// Each invocation owns its reporter and mutable diagnostic collection.
	const diagnosticManager = dependencies.diagnosticManager.createRun(
		context.reporter
	);

	// Generic graph resolution for all registries
	const helperOrders = new Map<string, RegisteredHelper<unknown>[]>();

	for (const [kind, entries] of dependencies.helperRegistries) {
		const helpers = entries as RegisteredHelper<HelperDescriptor>[];
		const graph = createDependencyGraph(
			helpers,
			{
				onMissingDependency: (issue) => {
					diagnosticManager.flagMissingDependency(
						issue.dependant.helper,
						issue.dependencyKey,
						kind
					);
					diagnosticManager.flagUnusedHelper(
						issue.dependant.helper,
						kind,
						'has missing dependencies',
						issue.dependant.helper.dependsOn ?? []
					);
				},
				onUnresolvedHelpers: ({ unresolved }) => {
					for (const entry of unresolved) {
						diagnosticManager.flagUnusedHelper(
							entry.helper,
							kind,
							'has unresolved dependencies (possible cycle)',
							entry.helper.dependsOn ?? []
						);
					}
				},
				providedKeys: dependencies.options.providedKeys?.[kind],
			},
			dependencies.options.createError
		);
		helperOrders.set(kind, graph.order);
	}

	const userState = dependencies.options.createState({
		context,
		options: runOptions,
	});

	const steps: PipelineStep[] = [];
	const pushStep = createStepRecorder(steps);

	const buildHookOptions = (
		currentState: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		lifecycle: PipelineExtensionLifecycle
	) => ({
		context,
		options: runOptions,
		artifact: currentState.userState,
		lifecycle,
	});

	const state = {
		context,
		reporter: context.reporter,
		runOptions,
		userState,
		steps,

		diagnostics: diagnosticManager.getDiagnostics(),
		diagnosticManager,
		helperOrders,
		extensionHooks: [...dependencies.extensionHooks],
		executedLifecycles: new Set(),
		rollbackJournal: [],

		extensionStack: [],
		onExtensionRollbackError: dependencies.options.onExtensionRollbackError
			? (event) =>
					dependencies.options.onExtensionRollbackError?.({
						...event,
						hookSequence: event.extensionKeys,
						context,
					})
			: undefined,
		committedExtensionStates: new Set(),
	} satisfies AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;

	return {
		state,
		pushStep,
		buildHookOptions,
	};
};

export const prepareResumeContext = <
	TRunOptions,
	TUserState,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
>(
	_dependencies: AgnosticRunnerDependencies<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic,
		TRunResult
	>,
	snapshot: PipelinePauseSnapshot<
		AgnosticState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>
	>
): AgnosticRunContext<
	TRunOptions,
	TUserState,
	TContext,
	TReporter,
	TDiagnostic
> => {
	const state = snapshot.state;
	const context = state.context;

	const diagnosticManager = state.diagnosticManager;
	diagnosticManager.setReporter(context.reporter);

	const pushStep = createStepRecorder(state.steps);

	const buildHookOptions = (
		currentState: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		lifecycle: PipelineExtensionLifecycle
	) => ({
		context,
		options: state.runOptions,
		artifact: currentState.userState,
		lifecycle,
	});

	return {
		state,
		pushStep,
		buildHookOptions,
	};
};

const createStepRecorder =
	(steps: PipelineStep[]) =>
	(entry: RegisteredHelper<unknown>): void => {
		const helper = entry.helper as {
			readonly key: string;
			readonly kind: string;
			readonly mode: PipelineStep['mode'];
			readonly priority: number;
			readonly dependsOn: readonly string[];
			readonly origin?: string;
		};
		steps.push({
			key: helper.key,
			kind: helper.kind,
			mode: helper.mode,
			priority: helper.priority,
			dependsOn: helper.dependsOn,
			origin: helper.origin,
			id: entry.id,
			index: entry.index,
		});
	};
