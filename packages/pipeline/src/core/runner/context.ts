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
	PipelineExtensionRollbackErrorMetadata,
	PipelinePauseSnapshot,
	PipelineStep,
} from '../types';
import { initExtensionCoordinator } from '../internal/extension-coordinator';

/* eslint-disable @typescript-eslint/no-explicit-any */
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
	const diagnosticManager =
		typeof dependencies.diagnosticManager.createRun === 'function'
			? dependencies.diagnosticManager.createRun(context.reporter)
			: dependencies.diagnosticManager;
	if (diagnosticManager === dependencies.diagnosticManager) {
		diagnosticManager.prepareRun();
		diagnosticManager.setReporter(context.reporter);
	}

	// Generic graph resolution for all registries
	const helperOrders = new Map<string, RegisteredHelper<unknown>[]>();

	for (const [kind, entries] of dependencies.helperRegistries) {
		const graph = createDependencyGraph(
			entries as any,
			{
				onMissingDependency: (issue) => {
					diagnosticManager.flagMissingDependency(
						issue.dependant.helper as any,
						issue.dependencyKey,
						kind
					);
					diagnosticManager.flagUnusedHelper(
						issue.dependant.helper as any,
						kind,
						'has missing dependencies',
						(issue.dependant.helper as any).dependsOn ?? []
					);
				},
				onUnresolvedHelpers: ({ unresolved }) => {
					for (const entry of unresolved) {
						diagnosticManager.flagUnusedHelper(
							entry.helper as any,
							kind,
							'has unresolved dependencies (possible cycle)',
							(entry.helper as any).dependsOn ?? []
						);
					}
				},
				providedKeys: dependencies.options.providedKeys?.[kind],
			},
			dependencies.options.createError
		);
		helperOrders.set(kind, graph.order as any);
	}

	const userState = dependencies.options.createState({
		context,
		options: runOptions,
	});

	const steps: any[] = [];
	const pushStep = (entry: RegisteredHelper<unknown>) => {
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
		} satisfies PipelineStep);
	};

	const handleRollbackError = (options: {
		readonly error: unknown;
		readonly extensionKeys: readonly string[];
		readonly hookSequence: readonly string[];
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => {
		if (dependencies.options.onExtensionRollbackError) {
			dependencies.options.onExtensionRollbackError(options);
		}
	};

	const buildHookOptions = (
		currentState: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		lifecycle: string
	) => ({
		context,
		options: runOptions,
		artifact: currentState.userState, // Extension expects UserState
		lifecycle,
	});

	const state = {
		context,
		reporter: context.reporter,
		runOptions,
		userState,
		steps,

		diagnostics: diagnosticManager.getDiagnostics() as TDiagnostic[], // Live reference
		diagnosticManager,
		// AgnosticState definition has diagnostics: TDiagnostic[]. Programs read it from here.
		// finalizeResultStage updates it from manager.

		helperRegistries: dependencies.helperRegistries,
		helperOrders,
		executedLifecycles: new Set(),
		// Runtime maps
		helperExecution: new Map(),
		helperRollbacks: new Map(),
		helperRollbackStack: [],

		extensionCoordinator: initExtensionCoordinator((event) =>
			handleRollbackError({
				...event,
				context,
			})
		),
		committedExtensionStates: new Set(),
	} as unknown as AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;

	return {
		runOptions,
		context,
		state,
		steps,
		pushStep,
		helperRegistries: dependencies.helperRegistries,
		helperOrders,
		diagnosticManager,
		buildHookOptions,
		handleRollbackError,
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
	dependencies: AgnosticRunnerDependencies<
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

	const diagnosticManager =
		state.diagnosticManager ??
		(typeof dependencies.diagnosticManager.createRun === 'function'
			? dependencies.diagnosticManager.createRun(
					context.reporter,
					state.diagnostics
				)
			: dependencies.diagnosticManager);
	diagnosticManager.setReporter(context.reporter);

	const steps = state.steps;
	const pushStep = (entry: RegisteredHelper<unknown>) => {
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

	const handleRollbackError = (options: {
		readonly error: unknown;
		readonly extensionKeys: readonly string[];
		readonly hookSequence: readonly string[];
		readonly errorMetadata: PipelineExtensionRollbackErrorMetadata;
		readonly context: TContext;
	}) => {
		if (dependencies.options.onExtensionRollbackError) {
			dependencies.options.onExtensionRollbackError(options);
		}
	};

	const buildHookOptions = (
		currentState: AgnosticState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		lifecycle: string
	) => ({
		context,
		options: state.runOptions,
		artifact: currentState.userState,
		lifecycle,
	});

	return {
		runOptions: state.runOptions,
		context,
		state,
		steps,
		pushStep,
		helperRegistries: state.helperRegistries,
		helperOrders: state.helperOrders ?? new Map(),
		diagnosticManager,
		buildHookOptions,
		handleRollbackError,
	};
};
