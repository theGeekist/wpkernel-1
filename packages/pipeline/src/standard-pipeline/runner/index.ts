import { makePipeline } from '../../core/makePipeline';
import { isPaused } from '../../core/runner/stage-factories';
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
 * 1. Fragments (Parallel/Ordered)
 * 2. Fragment finalisation
 * 3. After Fragments
 * 4. Before Builders
 * 5. Builders (Parallel/Ordered)
 * 6. After Builders
 * 7. Finalize
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
	const pendingArtifact = Symbol('pipeline.pending-artifact');
	type StandardState = {
		buildOptions: TBuildOptions;
		draft: TDraft;
		artifact: TArtifact | typeof pendingArtifact;
	};
	const readArtifact = (state: StandardState): TArtifact => {
		if (state.artifact === pendingArtifact) {
			throw new Error('Pipeline artifact is not available yet.');
		}
		return state.artifact;
	};
	type StageState = PipelineStageState<
		TRunOptions,
		StandardState,
		TContext,
		TReporter,
		TDiagnostic
	>;
	type CoreOptions = AgnosticPipelineOptions<
		TRunOptions,
		TContext,
		TReporter,
		StandardState,
		TDiagnostic,
		TRunResult,
		TFragmentKind | TBuilderKind
	>;
	const readHelperExecution = <TSelectedKind extends HelperKind>(
		state: StageState,
		kind: TSelectedKind
	): HelperExecutionSnapshot<TSelectedKind> =>
		(state.helperExecution?.get(kind) ?? {
			kind,
			executed: [],
			missing: [],
			registered: [],
		}) as HelperExecutionSnapshot<TSelectedKind>;

	const fragmentKind = (options.fragmentKind ?? 'fragment') as TFragmentKind;
	const builderKind = (options.builderKind ?? 'builder') as TBuilderKind;

	const agnosticOptions: CoreOptions = {
		helperKinds: [fragmentKind, builderKind],
		createContext: options.createContext,
		createError: options.createError,
		extensions: {
			artifact: {
				read: readArtifact,
				write: (state, artifact) => ({
					...state,
					artifact: artifact as TArtifact,
				}),
			},
		},
		onExtensionRollbackError: options.onExtensionRollbackError,
		onHelperRollbackError: options.onHelperRollbackError
			? (rollbackOptions) =>
					options.onHelperRollbackError?.({
						...rollbackOptions,
						helper: rollbackOptions.helper as
							| TFragmentHelper
							| TBuilderHelper,
					})
			: undefined,

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
				artifact: pendingArtifact,
			};
		},
		onDiagnostic: options.onDiagnostic,
		createConflictDiagnostic:
			options.createConflictDiagnostic as CoreOptions['createConflictDiagnostic'],
		createMissingDependencyDiagnostic:
			options.createMissingDependencyDiagnostic as CoreOptions['createMissingDependencyDiagnostic'],
		createUnusedHelperDiagnostic:
			options.createUnusedHelperDiagnostic as CoreOptions['createUnusedHelperDiagnostic'],
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
						draft: state.userState.draft,
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

				const fragments = readHelperExecution(state, fragmentKind);
				const metadata: FragmentFinalizationMetadata<TFragmentKind> = {
					fragments,
				};
				const result = options.finalizeFragmentState({
					draft: state.userState.draft,
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
				fragmentStage,
				finalizeFragmentStage,
				makeLifecycleStage('after-fragments'),
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
							artifact: readArtifact(state.userState),
						}),
					writeOutput: (state, output) =>
						options.adoptBuilderOutput
							? {
									...state,
									userState: {
										...state.userState,
										artifact: options.adoptBuilderOutput({
											artifact: readArtifact(
												state.userState
											),
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
					artifact: readArtifact(state),
					diagnostics,
					steps,
					context,
					buildOptions: state.buildOptions,
					options: runOpts,
					helpers: {
						fragments: readHelperExecution(
							agnosticState,
							fragmentKind
						),
						builders: readHelperExecution(
							agnosticState,
							builderKind
						),
					},
				});
			}
			return {
				artifact: readArtifact(state),
				diagnostics,
				steps,
			} as unknown as TRunResult;
		},
	};

	const pipeline = makePipeline(agnosticOptions);
	const registerHelper = (
		helper: TFragmentHelper | TBuilderHelper,
		kind: TFragmentKind | TBuilderKind,
		surface: 'ir.use()' | 'builders.use()'
	) => {
		if (helper.kind !== kind) {
			const message = `Attempted to register helper of kind "${helper.kind}" via ${surface} (expected "${kind}")`;
			if (options.createError) {
				throw options.createError('ValidationError', message);
			}
			const error = new Error(message);
			error.name = 'ValidationError';
			throw error;
		}
		pipeline.use({
			...helper,
			kind,
		} as unknown as Helper<
			TContext,
			unknown,
			unknown,
			TReporter,
			HelperKind
		>);
	};

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
			use: (helper: TFragmentHelper) =>
				registerHelper(helper, fragmentKind, 'ir.use()'),
		},
		builders: {
			use: (helper: TBuilderHelper) =>
				registerHelper(helper, builderKind, 'builders.use()'),
		},
		extensions: {
			use: (extension) =>
				pipeline.extensions.use({
					...extension,
					register: () => extension.register(wrapper),
				} as unknown as Parameters<typeof pipeline.extensions.use>[0]),
		},
		use: (helper) => pipeline.use(helper),
		run: (opts) => pipeline.run(opts),
	};

	return wrapper;
}
