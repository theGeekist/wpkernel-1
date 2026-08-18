import { adoptMaybePromise, maybeThen, maybeTry } from './async-utils.js';
import { type RegisteredHelper } from './dependency-graph.js';
import { createDefaultError } from './error-factory.js';
import type { ExtensionHookEntry } from './extensions/index.js';
import {
	handleExtensionRegisterResult,
	registerHelper,
} from './registration.js';
import { createAgnosticDiagnosticManager } from './runner/diagnostics.js';
import type {
	AgnosticRunnerDependencies,
	AgnosticState,
	Halt,
	PipelineStage,
} from './runner/types.js';
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
} from './types.js';

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
	const helperRegistries = new Map<string, RegisteredHelper<unknown>[]>(
		options.helperKinds.map((kind) => [kind, []])
	);

	const extensionHooks: ExtensionHookEntry<
		TContext,
		TRunOptions,
		TUserState
	>[] = [];
	type ExtensionRegistrationSlot = {
		hooks: ExtensionHookEntry<TContext, TRunOptions, TUserState>[];
	};
	const extensionRegistrationSlots: ExtensionRegistrationSlot[] = [];
	const extensionKeys = new Set<string>();
	let anonymousExtensionSequence = 0;
	const reserveExtensionKey = (requestedKey?: string): string => {
		let key = requestedKey;
		if (key === undefined) {
			do {
				anonymousExtensionSequence += 1;
				key = `pipeline.extension#${anonymousExtensionSequence}`;
			} while (extensionKeys.has(key));
		}

		if (extensionKeys.has(key)) {
			throw createError(
				'ValidationError',
				`Extension key "${key}" is already registered.`
			);
		}
		extensionKeys.add(key);
		return key;
	};
	const refreshExtensionHooks = () => {
		extensionHooks.splice(
			0,
			extensionHooks.length,
			...extensionRegistrationSlots.flatMap((slot) => slot.hooks)
		);
	};
	const pendingExtensionRegistrations = new Set<Promise<void>>();
	let extensionRegistrationFailure: { readonly error: unknown } | undefined;
	const failRegistration = (error: unknown) => {
		extensionRegistrationFailure ??= { error };
	};
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
			createState: options.createState,
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
		const adopted = adoptMaybePromise(registration);
		if (adopted.promise === null) {
			return adopted.value;
		}

		const pending = adopted.promise.then(() => undefined);
		pendingExtensionRegistrations.add(pending);
		void pending.then(
			() => pendingExtensionRegistrations.delete(pending),
			(error) => {
				pendingExtensionRegistrations.delete(pending);
				failRegistration(error);
			}
		);
		return adopted.promise;
	};

	const waitForExtensionRegistrations = (): MaybePromise<void> => {
		if (extensionRegistrationFailure) {
			throw extensionRegistrationFailure.error;
		}
		if (pendingExtensionRegistrations.size === 0) {
			return;
		}

		return maybeTry(
			() =>
				maybeThen(
					Promise.all([...pendingExtensionRegistrations]),
					waitForExtensionRegistrations
				),
			(error) => {
				failRegistration(error);
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
			try {
				const extensionKey = reserveExtensionKey(extension.key);
				const slot: ExtensionRegistrationSlot = { hooks: [] };
				extensionRegistrationSlots.push(slot);
				const registration = extension.register(pipeline);
				const handled = maybeThen(registration, (registered) => {
					const result = handleExtensionRegisterResult(
						extensionKey,
						adaptExtensionRegistration(registered),
						slot.hooks
					);
					refreshExtensionHooks();
					return result;
				});
				return trackExtensionRegistration(handled);
			} catch (error) {
				failRegistration(error);
				throw error;
			}
		},
		registerHelper<TInput, TOutput, TSelectedKind extends HelperKind>(
			helper: Helper<TContext, TInput, TOutput, TReporter, TSelectedKind>
		) {
			const kind = helper.kind;
			if (!helperRegistries.has(kind)) {
				throw createError(
					'ValidationError',
					`Helper kind "${kind}" is not configured for this pipeline.`
				);
			}
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
				helperRegistries.get(kind)! as RegisteredHelper<
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
