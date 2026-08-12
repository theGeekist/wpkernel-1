import { isPromiseLike, maybeThen, maybeTry } from './async-utils';
import { type RegisteredHelper } from './dependency-graph';
import { createDefaultError } from './error-factory';
import type { ExtensionHookEntry } from './extensions';
import { handleExtensionRegisterResult, registerHelper } from './registration';
import { createAgnosticDiagnosticManager } from './runner/diagnostics';
import type {
	AgnosticRunnerDependencies,
	AgnosticState,
	Halt,
	PipelineStage,
} from './runner/types';
import type {
	AgnosticPipelineOptions,
	Helper,
	HelperDescriptor,
	HelperKind,
	MaybePromise,
	PipelineDiagnostic,
	PipelineExtension,
	PipelineExtensionHook,
	PipelineExtensionHookRegistration,
	PipelineReporter,
	PipelineStage as PublicPipelineStage,
	PipelineStageDependencies,
	PipelineStageState,
} from './types';

interface PipelineRuntimeOptions {
	readonly supportsPause?: boolean;
}

export function createPipelineRuntime<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter,
	TUserState,
	TDiagnostic extends PipelineDiagnostic,
	TRunResult,
	TKind extends HelperKind,
>(
	options: AgnosticPipelineOptions<
		TRunOptions,
		TContext,
		TReporter,
		TUserState,
		TDiagnostic,
		TRunResult,
		TKind
	>,
	runtimeOptions: PipelineRuntimeOptions = {}
) {
	const createError = options.createError ?? createDefaultError;
	const helperRegistries = new Map<string, RegisteredHelper<unknown>[]>();
	const ensureRegistry = (kind: string) => {
		let registry = helperRegistries.get(kind);
		if (registry === undefined) {
			registry = [];
			helperRegistries.set(kind, registry);
		}
		return registry;
	};

	for (const kind of options.helperKinds) {
		ensureRegistry(kind);
	}

	const extensionHooks: ExtensionHookEntry<
		TContext,
		TRunOptions,
		TUserState
	>[] = [];
	const pendingExtensionRegistrations = new Set<Promise<void>>();
	const extensionRegistrationFailures: unknown[] = [];
	const artifactAdapter = options.extensions?.artifact;
	const adaptExtensionHook = (
		hook: PipelineExtensionHook<TContext, TRunOptions, unknown>
	): PipelineExtensionHook<TContext, TRunOptions, TUserState> => {
		if (!artifactAdapter) {
			return hook as PipelineExtensionHook<
				TContext,
				TRunOptions,
				TUserState
			>;
		}

		return (hookOptions) =>
			maybeThen(
				hook({
					...hookOptions,
					artifact: artifactAdapter.read(hookOptions.artifact),
				}),
				(result) => {
					if (!result) {
						return result;
					}
					if (result.artifact === undefined) {
						const { artifact: _artifact, ...unchangedResult } =
							result;
						return unchangedResult;
					}

					return {
						...result,
						artifact: artifactAdapter.write(
							hookOptions.artifact,
							result.artifact
						),
					};
				}
			);
	};
	const adaptExtensionRegistration = (result: unknown): unknown => {
		if (typeof result === 'function') {
			return adaptExtensionHook(
				result as PipelineExtensionHook<TContext, TRunOptions, unknown>
			);
		}
		if (
			result &&
			typeof result === 'object' &&
			'hook' in result &&
			typeof result.hook === 'function'
		) {
			const registration = result as PipelineExtensionHookRegistration<
				TContext,
				TRunOptions,
				unknown
			>;
			return {
				...registration,
				hook: adaptExtensionHook(registration.hook),
			};
		}
		return result;
	};

	const diagnosticManager = createAgnosticDiagnosticManager<
		TReporter,
		TDiagnostic
	>({
		onDiagnostic: (args) => {
			if (options.onDiagnostic) {
				options.onDiagnostic(args);
				return;
			}
			args.reporter.warn?.(
				'Pipeline diagnostic reported.',
				args.diagnostic
			);
		},
		createConflictDiagnostic: options.createConflictDiagnostic,
		createMissingDependencyDiagnostic:
			options.createMissingDependencyDiagnostic,
		createUnusedHelperDiagnostic: options.createUnusedHelperDiagnostic,
	});

	const defaultStages = (
		deps: PipelineStageDependencies<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic,
			TRunResult,
			TKind
		>
	): PublicPipelineStage<
		PipelineStageState<
			TRunOptions,
			TUserState,
			TContext,
			TReporter,
			TDiagnostic
		>,
		TRunResult
	>[] => [
		...options.helperKinds.map((kind) => deps.makeHelperStage(kind)),
		deps.finalizeResult,
	];

	const runnerDependencies: AgnosticRunnerDependencies<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic,
		TRunResult
	> = {
		options: {
			createContext: options.createContext,
			createState: (args) =>
				options.createState
					? options.createState(args)
					: ({} as TUserState),
			createError,
			supportsPause: runtimeOptions.supportsPause,
			onExtensionRollbackError: (rollbackOptions) => {
				options.onExtensionRollbackError?.(rollbackOptions);
				const metadata = rollbackOptions.errorMetadata;
				rollbackOptions.context.reporter.warn?.(
					'Pipeline extension rollback failed.',
					{
						...rollbackOptions,
						extensions: rollbackOptions.extensionKeys,
						hookKeys: rollbackOptions.hookSequence,
						errorName: metadata?.name,
						errorMessage: metadata?.message,
						errorStack: metadata?.stack,
						errorCause: metadata?.cause,
						...metadata,
					}
				);
			},
			onHelperRollbackError: (rollbackOptions) => {
				options.onHelperRollbackError?.(rollbackOptions);
				rollbackOptions.context.reporter.warn?.(
					'Helper rollback failed',
					rollbackOptions
				);
			},
			providedKeys: options.providedKeys as
				| Record<string, readonly string[]>
				| undefined,
		},
		helperRegistries,
		diagnosticManager,
		resolveRunResult: (runState) => {
			const {
				userState: artifact,
				diagnostics,
				steps,
				context,
				options: runOptions,
				state,
			} = runState;

			return options.createRunResult
				? options.createRunResult({
						artifact,
						diagnostics,
						steps,
						context,
						options: runOptions,
						state: state as unknown as PipelineStageState<
							TRunOptions,
							TUserState,
							TContext,
							TReporter,
							TDiagnostic
						>,
					})
				: ({ artifact, diagnostics, steps } as TRunResult);
		},
		extensionHooks,
		extensionLifecycles: options.extensions?.lifecycles,
		stages: (deps) =>
			[
				...(options.createStages ?? defaultStages)(
					deps as PipelineStageDependencies<
						TRunOptions,
						TUserState,
						TContext,
						TReporter,
						TDiagnostic,
						TRunResult,
						TKind
					>
				),
			] as unknown as PipelineStage<
				AgnosticState<
					TRunOptions,
					TUserState,
					TContext,
					TReporter,
					TDiagnostic
				>,
				Halt<TRunResult>
			>[],
	};

	const trackExtensionRegistration = <T>(
		registration: MaybePromise<T>
	): MaybePromise<T> => {
		if (!isPromiseLike(registration)) {
			return registration;
		}

		const pending = maybeThen(
			registration,
			() => undefined
		) as Promise<void>;
		pendingExtensionRegistrations.add(pending);
		void pending.then(
			() => pendingExtensionRegistrations.delete(pending),
			(error) => {
				pendingExtensionRegistrations.delete(pending);
				extensionRegistrationFailures.push(error);
			}
		);
		return registration;
	};

	const consumeFailure = (error?: unknown) => {
		const index = extensionRegistrationFailures.findIndex((failure) =>
			Object.is(failure, error)
		);
		if (index >= 0) {
			extensionRegistrationFailures.splice(index, 1);
		} else if (extensionRegistrationFailures.length > 0) {
			extensionRegistrationFailures.shift();
		}
	};

	const waitForExtensionRegistrations = (): MaybePromise<void> => {
		if (extensionRegistrationFailures.length > 0) {
			const error = extensionRegistrationFailures[0];
			consumeFailure(error);
			throw error;
		}
		if (pendingExtensionRegistrations.size === 0) {
			return;
		}

		return maybeTry(
			() =>
				maybeThen(
					Promise.all([...pendingExtensionRegistrations]),
					() => undefined
				),
			(error) => {
				consumeFailure(error);
				throw error;
			}
		);
	};

	return {
		runnerDependencies,
		registerExtension<TPipeline>(
			pipeline: TPipeline,
			extension: PipelineExtension<
				TPipeline,
				TContext,
				TRunOptions,
				unknown
			>
		) {
			const registration = extension.register(pipeline);
			const handled = maybeThen(registration, (registered) =>
				handleExtensionRegisterResult(
					extension.key,
					adaptExtensionRegistration(registered),
					extensionHooks
				)
			);
			return trackExtensionRegistration(handled);
		},
		registerHelper<TInput, TOutput, TSelectedKind extends HelperKind>(
			helper: Helper<TContext, TInput, TOutput, TReporter, TSelectedKind>
		) {
			const kind = helper.kind;
			registerHelper<
				TContext,
				unknown,
				unknown,
				TReporter,
				HelperKind,
				Helper<TContext, unknown, unknown, TReporter, HelperKind>
			>(
				helper as Helper<
					TContext,
					unknown,
					unknown,
					TReporter,
					HelperKind
				>,
				kind,
				ensureRegistry(kind) as RegisteredHelper<
					Helper<TContext, unknown, unknown, TReporter, HelperKind>
				>[],
				kind,
				(helperDescriptor, existing, message) =>
					diagnosticManager.flagConflict(
						helperDescriptor as HelperDescriptor,
						existing as HelperDescriptor,
						kind,
						message
					),
				createError
			);
		},
		afterRegistrations<TResult>(run: () => MaybePromise<TResult>) {
			return maybeThen(waitForExtensionRegistrations(), run);
		},
	};
}
