import { makePipeline } from '../../core/makePipeline';
import { isPaused } from '../../core/runner/stage-factories';
import { maybeThen } from '../../core/async-utils';
import type {
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
	HelperKind,
	Helper,
	HelperExecutionSnapshot,
	AgnosticPipelineOptions,
	HelperDescriptor,
	PipelineRegisteredHelper,
	PipelineStage as PublicPipelineStage,
	PipelineStageState,
} from '../../core/types';
import type {
	CreatePipelineOptions,
	Pipeline,
	FragmentFinalizationMetadata,
} from '../types';

/**
 * Creates a standard pipeline with "fragment" and "builder" stages.
 *
 * This adapter wraps the agnostic core pipeline, enforcing the opinionated
 * standard pipeline lifecycle:
 * 1. Prepare
 * 2. Before Fragments
 * 3. Fragments (Parallel/Ordered)
 * 4. After Fragments
 * 5. Before Builders
 * 6. Builders (Parallel/Ordered)
 * 7. After Builders
 * 8. Finalize
 * @param options
 */
export function createStandardPipeline<
	TRunOptions,
	TBuildOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TDraft = unknown,
	TArtifact = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TArtifact, TDiagnostic>,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
	TFragmentKind extends HelperKind = 'fragment',
	TBuilderKind extends HelperKind = 'builder',
	TFragmentHelper extends Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter,
		TFragmentKind
	> = Helper<
		TContext,
		TFragmentInput,
		TFragmentOutput,
		TReporter,
		TFragmentKind
	>,
	TBuilderHelper extends Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter,
		TBuilderKind
	> = Helper<
		TContext,
		TBuilderInput,
		TBuilderOutput,
		TReporter,
		TBuilderKind
	>,
>(
	options: CreatePipelineOptions<
		TRunOptions,
		TBuildOptions,
		TContext,
		TReporter,
		TDraft,
		TArtifact,
		TDiagnostic,
		TRunResult,
		TFragmentInput,
		TFragmentOutput,
		TBuilderInput,
		TBuilderOutput,
		TFragmentKind,
		TBuilderKind,
		TFragmentHelper,
		TBuilderHelper
	>
): Pipeline<
	TRunOptions,
	TRunResult,
	TContext,
	TReporter,
	TBuildOptions,
	TArtifact,
	TFragmentInput,
	TFragmentOutput,
	TBuilderInput,
	TBuilderOutput,
	TDiagnostic,
	TFragmentKind,
	TBuilderKind,
	TFragmentHelper,
	TBuilderHelper
> {
	// 1. Define Standard State Wrapper
	type StandardState = {
		buildOptions: TBuildOptions;
		draft: TDraft;
		artifact: TArtifact | null;
	};
	type StageState = PipelineStageState<
		TRunOptions,
		StandardState,
		TContext,
		TReporter,
		TDiagnostic
	>;

	const fragmentKind = (options.fragmentKind ?? 'fragment') as TFragmentKind;
	const builderKind = (options.builderKind ?? 'builder') as TBuilderKind;

	// 2. Map Options to Agnostic
	const agnosticOptions: AgnosticPipelineOptions<
		TRunOptions,
		TContext,
		TReporter,
		StandardState,
		TDiagnostic,
		TRunResult,
		TFragmentKind | TBuilderKind
	> = {
		helperKinds: [fragmentKind, builderKind],
		createContext: options.createContext,
		createError: options.createError,
		onExtensionRollbackError: options.onExtensionRollbackError,

		createState: ({ options: runOpts, context }) => {
			const buildOptions = options.createBuildOptions(runOpts);
			const draft = options.createFragmentState({
				options: runOpts,
				context,
				buildOptions,
			});
			return {
				buildOptions,
				draft,
				artifact: null,
			};
		},
		onDiagnostic: options.onDiagnostic,
		createConflictDiagnostic: options.createConflictDiagnostic
			? (opts) =>
					options.createConflictDiagnostic!(
						opts as unknown as Parameters<
							NonNullable<typeof options.createConflictDiagnostic>
						>[0]
					)
			: undefined,
		createMissingDependencyDiagnostic:
			options.createMissingDependencyDiagnostic
				? (opts) =>
						options.createMissingDependencyDiagnostic!(
							opts as unknown as Parameters<
								NonNullable<
									typeof options.createMissingDependencyDiagnostic
								>
							>[0]
						)
				: undefined,
		createUnusedHelperDiagnostic: options.createUnusedHelperDiagnostic
			? (opts) =>
					options.createUnusedHelperDiagnostic!(
						opts as unknown as Parameters<
							NonNullable<
								typeof options.createUnusedHelperDiagnostic
							>
						>[0]
					)
			: undefined,
		providedKeys: {
			[fragmentKind]: options.fragmentProvidedKeys ?? [],
			[builderKind]: options.builderProvidedKeys ?? [],
		} as Partial<Record<TFragmentKind | TBuilderKind, readonly string[]>>,

		createStages: (deps) => {
			const {
				makeHelperStage,
				makeLifecycleStage,
				finalizeResult,
				diagnostics,
			} = deps;

			const onVisited =
				<
					TSelectedKind extends TFragmentKind | TBuilderKind,
					THelper extends HelperDescriptor<TSelectedKind>,
				>(
					kind: TSelectedKind
				) =>
				(
					state: StageState,
					visited: ReadonlySet<string>,
					registered: readonly PipelineRegisteredHelper<THelper>[]
				) => {
					for (const entry of registered) {
						if (!visited.has(entry.id)) {
							diagnostics.flagUnusedHelper(
								entry.helper,
								kind,
								'was registered but never executed',
								entry.helper.dependsOn
							);
						}
					}
					return state;
				};

			const fragmentStage = makeHelperStage<
				TFragmentInput,
				TFragmentOutput,
				TFragmentKind,
				TFragmentHelper
			>(fragmentKind, {
				makeArgs: (state) => (entry) => {
					return options.createFragmentArgs({
						helper: entry.helper,
						options: state.runOptions,
						context: state.context,
						buildOptions: state.userState.buildOptions,
						draft: state.userState.draft!,
					});
				},
				writeOutput: (state, output) =>
					options.adoptFragmentOutput
						? {
								...state,
								userState: {
									...state.userState,
									draft: options.adoptFragmentOutput({
										draft: state.userState.draft,
										output,
									}),
								},
							}
						: state,
				onVisited: onVisited(fragmentKind),
			});

			const finalizeFragmentStage: PublicPipelineStage<
				StageState,
				TRunResult
			> = (state) => {
				if (deps.isHalt(state) || isPaused(state)) {
					return state;
				}

				const fragments = (state.helperExecution?.get(fragmentKind) ?? {
					kind: fragmentKind,
					executed: [],
					missing: [],
					registered: [],
				}) as HelperExecutionSnapshot<TFragmentKind>;
				const metadata: FragmentFinalizationMetadata<TFragmentKind> = {
					fragments,
				};
				const result = options.finalizeFragmentState({
					draft: state.userState.draft!,
					options: state.runOptions,
					context: state.context,
					buildOptions: state.userState.buildOptions,
					helpers: metadata,
				});

				return {
					...state,
					userState: {
						...state.userState,
						artifact: result,
					},
				};
			};

			return [
				makeLifecycleStage('prepare'),
				makeLifecycleStage('before-fragments'),
				fragmentStage,
				makeLifecycleStage('after-fragments'),
				finalizeFragmentStage,
				makeLifecycleStage('before-builders'),
				// Standard Builder Stage
				makeHelperStage<
					TBuilderInput,
					TBuilderOutput,
					TBuilderKind,
					TBuilderHelper
				>(builderKind, {
					makeArgs: (state) => (entry) =>
						options.createBuilderArgs({
							helper: entry.helper,
							options: state.runOptions,
							context: state.context,
							buildOptions: state.userState.buildOptions,
							artifact: state.userState.artifact!,
						}),
					writeOutput: (state, output) =>
						options.adoptBuilderOutput
							? {
									...state,
									userState: {
										...state.userState,
										artifact: options.adoptBuilderOutput({
											artifact: state.userState.artifact!,
											output,
										}),
									},
								}
							: state,
					onVisited: onVisited(builderKind),
				}),
				makeLifecycleStage('after-builders'),
				makeLifecycleStage('finalize'),
				finalizeResult,
			];
		},

		createRunResult: ({
			artifact: state,
			context,
			steps,
			diagnostics,
			options: runOpts,
			state: agnosticState,
		}) => {
			if (options.createRunResult) {
				return options.createRunResult({
					artifact: state.artifact as TArtifact,
					diagnostics,
					steps,
					context,
					buildOptions: state.buildOptions,
					options: runOpts,
					helpers: {
						fragments:
							(agnosticState.helperExecution?.get(
								fragmentKind
							) as unknown as HelperExecutionSnapshot<TFragmentKind>) ??
							({
								kind: fragmentKind,
								executed: [],
								missing: [],
								registered: [],
							} as unknown as HelperExecutionSnapshot<TFragmentKind>),
						builders:
							(agnosticState.helperExecution?.get(
								builderKind
							) as unknown as HelperExecutionSnapshot<TBuilderKind>) ??
							({
								kind: builderKind,
								executed: [],
								missing: [],
								registered: [],
							} as unknown as HelperExecutionSnapshot<TBuilderKind>),
					},
				});
			}
			return {
				artifact: state.artifact,
				diagnostics,
				steps,
			} as unknown as TRunResult;
		},
	};

	// 3. Create Pipeline
	const pipeline = makePipeline(agnosticOptions);

	// 4. Adapt to Standard Pipeline Interface
	const wrapper: Pipeline<
		TRunOptions,
		TRunResult,
		TContext,
		TReporter,
		TBuildOptions,
		TArtifact,
		TFragmentInput,
		TFragmentOutput,
		TBuilderInput,
		TBuilderOutput,
		TDiagnostic,
		TFragmentKind,
		TBuilderKind,
		TFragmentHelper,
		TBuilderHelper
	> = {
		fragmentKind,
		builderKind,
		ir: {
			use: (helper: TFragmentHelper) => {
				if (helper.kind && helper.kind !== fragmentKind) {
					const message = `Attempted to register helper of kind "${helper.kind}" via ir.use() (expected "${fragmentKind}")`;
					if (options.createError) {
						throw options.createError('ValidationError', message);
					}
					const error = new Error(message);
					error.name = 'ValidationError';
					throw error;
				}
				pipeline.use({
					...helper,
					kind: fragmentKind,
				} as unknown as Helper<
					TContext,
					unknown,
					unknown,
					TReporter,
					HelperKind
				>);
			},
		},
		builders: {
			use: (helper: TBuilderHelper) => {
				if (helper.kind && helper.kind !== builderKind) {
					const message = `Attempted to register helper of kind "${helper.kind}" via builders.use() (expected "${builderKind}")`;
					if (options.createError) {
						throw options.createError('ValidationError', message);
					}
					const error = new Error(message);
					error.name = 'ValidationError';
					throw error;
				}
				pipeline.use({
					...helper,
					kind: builderKind,
				} as unknown as Helper<
					TContext,
					unknown,
					unknown,
					TReporter,
					HelperKind
				>);
			},
		},
		extensions: {
			use: (extension) => {
				// Proxy the extension to pass the standard wrapper to register/setup
				// AND wrap the returned hook to adapt TState <-> TArtifact
				const proxyExtension = {
					...extension,
					register: () => {
						return maybeThen(
							extension.register(wrapper),
							(result) => {
								const adaptHook = (
									hook: (input: unknown) => unknown
								) => {
									return (input: {
										artifact: unknown;
										lifecycle: string;
									}) => {
										// Input.artifact is actually the StandardState (userState)
										const state =
											input.artifact as StandardState;
										const lifecycle =
											input.lifecycle as string;

										// Determine which state property to expose as "artifact" based on lifecycle
										// For standard pipeline:
										// - Before/during fragments: "artifact" exposed to extensions is usually the Draft
										// - After fragments: Draft
										// - Before/during builders: Artifact
										const usesDraft = [
											'prepare',
											'before-fragments',
											'after-fragments',
										].includes(lifecycle);
										const exposedArtifact = usesDraft
											? state.draft
											: state.artifact;

										// Call original hook with extracted artifact
										const hookResult = hook({
											...input,
											artifact: exposedArtifact,
										});

										// Handle result with maybeThen
										return maybeThen(
											hookResult,
											(res: unknown) => {
												if (
													res &&
													typeof res === 'object' &&
													'artifact' in res &&
													(
														res as {
															artifact: unknown;
														}
													).artifact !== undefined
												) {
													// Map result artifact back to correct state property
													if (usesDraft) {
														return {
															...res,
															artifact: {
																...state,
																draft: (
																	res as {
																		artifact: unknown;
																	}
																).artifact,
															},
														};
													}
													return {
														...res,
														artifact: {
															...state,
															artifact: (
																res as {
																	artifact: unknown;
																}
															).artifact,
														},
													};
												}
												return res;
											}
										);
									};
								};

								if (typeof result === 'function') {
									return adaptHook(
										result as (input: unknown) => unknown
									);
								}

								if (
									result &&
									typeof result === 'object' &&
									'hook' in result
								) {
									return {
										...result,
										hook: adaptHook(
											(
												result as {
													hook: (
														input: unknown
													) => unknown;
												}
											).hook
										),
									};
								}

								return result;
							}
						);
					},
				};
				return pipeline.extensions.use(
					proxyExtension as unknown as Parameters<
						typeof pipeline.extensions.use
					>[0]
				);
			},
		},
		use: (helper) =>
			pipeline.use(
				helper as unknown as Helper<
					TContext,
					unknown,
					unknown,
					TReporter,
					HelperKind
				>
			),
		run: (opts) => pipeline.run(opts),
	};

	return wrapper;
}
