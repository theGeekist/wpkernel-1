import { makePipeline } from '../../core/makePipeline.js';
import type {
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
	HelperKind,
	Helper,
	HelperExecutionSnapshot,
	AgnosticPipelineOptions,
	PipelineStage as PublicPipelineStage,
	PipelineStageState,
} from '../../core/types.js';
import type {
	CreatePipelineOptions,
	Pipeline,
	FragmentFinalizationMetadata,
} from '../types.js';

/**
 * Creates an opinionated {@link Pipeline} with fragment and builder helper
 * phases around a finalised public artifact.
 *
 * The complete phase sequence is:
 * 1. Ordered fragment helpers
 * 2. Fragment finalisation
 * 3. `after-fragments` extension hooks
 * 4. `before-builders` extension hooks
 * 5. Ordered builder helpers
 * 6. `after-builders` extension hooks
 * 7. `finalize` extension hooks
 * 8. Extension commit and result materialisation
 *
 * Fragment helpers receive a draft-facing output prepared by
 * `createFragmentArgs`. Builder helpers receive the finalised artifact prepared
 * by `createBuilderArgs`. Mutable outputs need no adapter. Immutable replacement
 * outputs become phase state only through `adoptFragmentOutput` or
 * `adoptBuilderOutput` in {@link CreatePipelineOptions}.
 *
 * Extension hooks always receive the finalised artifact, never the draft or
 * internal bookkeeping state. Artifact replacements flow into later hooks and
 * builders. Registration may be synchronous or asynchronous. Each run waits
 * for registration quiescence and then captures immutable helper and extension
 * orders, so later registration affects later runs only.
 *
 * Diagnostics are invocation-owned. `onDiagnostic` streams them without giving
 * observer failures control over settlement. Rollback observer failures are
 * likewise contained while remaining cleanup continues. A custom result type
 * requires `createRunResult`; otherwise the result is {@link PipelineRunState}.
 * The factory preserves synchronous settlement until participating work becomes
 * asynchronous.
 *
 * @example Register fragment and builder helpers on their dedicated surfaces
 * ```ts
 * const pipeline = createStandardPipeline({
 *   createBuildOptions: () => ({}),
 *   createContext: () => ({ reporter: console }),
 *   createFragmentState: () => [] as string[],
 *   createFragmentArgs: ({ context, draft }) => ({
 *     context,
 *     input: undefined,
 *     output: draft,
 *     reporter: context.reporter,
 *   }),
 *   finalizeFragmentState: ({ draft }) => ({ entries: draft }),
 *   createBuilderArgs: ({ context, artifact }) => ({
 *     context,
 *     input: undefined,
 *     output: artifact,
 *     reporter: context.reporter,
 *   }),
 * });
 *
 * pipeline.ir.use(fragmentHelper);
 * pipeline.builders.use(builderHelper);
 * const result = await pipeline.run({});
 * ```
 *
 * @param options - Standard pipeline factories, adapters and observers.
 * @returns A configured standard pipeline instance.
 * @see {@link Pipeline.extensions}
 * @public
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
	type StandardState = {
		buildOptions: TBuildOptions;
		draft: TDraft;
		artifact?: TArtifact;
	};
	const readArtifact = (state: StandardState): TArtifact =>
		state.artifact as TArtifact;
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
		state.helperExecution!.get(
			kind
		)! as HelperExecutionSnapshot<TSelectedKind>;

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
			const { makeHelperStage, makeLifecycleStage, finalizeResult } =
				deps;

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
			});

			const finalizeFragmentStage: PublicPipelineStage<
				StageState,
				TRunResult
			> = (state) => {
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
		surface: 'ir.use()' | 'builders.use()' | 'use()'
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
		pipeline.use(
			helper as unknown as Helper<
				TContext,
				TFragmentInput,
				TFragmentOutput,
				TReporter,
				TFragmentKind | TBuilderKind
			>
		);
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
		use: (helper) => registerHelper(helper, helper.kind, 'use()'),
		run: (opts) => pipeline.run(opts),
	};

	return wrapper;
}
