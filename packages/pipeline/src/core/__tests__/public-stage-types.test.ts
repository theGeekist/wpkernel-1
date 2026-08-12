import {
	isPromiseLike,
	makePipeline,
	type Helper,
	type MaybePromise,
	type MissingDependencyDiagnostic,
	type PipelineHelperRollback,
	type PipelineRegisteredHelper,
	type PipelineReporter,
	type PipelineRunState,
	type PipelineStage,
	type PipelineStageDependencies,
	type PipelineStageState,
} from '../../index';

type CompilerKind = 'compiler';
type CompilerOptions = { readonly source: string };
type CompilerState = {
	readonly graph: readonly string[];
	readonly revision: number;
};
type CompilerReporter = PipelineReporter & {
	readonly trace: (message: string) => void;
};
type CompilerContext = { readonly reporter: CompilerReporter };
type CompilerDiagnostic = MissingDependencyDiagnostic<CompilerKind>;
type CompilerResult = PipelineRunState<CompilerState, CompilerDiagnostic>;
type CompilerHelper = Helper<
	CompilerContext,
	CompilerOptions,
	CompilerState,
	CompilerReporter,
	CompilerKind
>;
type CompilerStageState = PipelineStageState<
	CompilerOptions,
	CompilerState,
	CompilerContext,
	CompilerReporter,
	CompilerDiagnostic
>;
type CompilerStageDependencies = PipelineStageDependencies<
	CompilerOptions,
	CompilerState,
	CompilerContext,
	CompilerReporter,
	CompilerDiagnostic,
	CompilerResult,
	CompilerKind
>;

const expectType = <T>(_value: T): void => undefined;

describe('public custom-stage types', () => {
	it('infers a complete custom-stage facade without private imports or casts', () => {
		const reporter: CompilerReporter = {
			trace: jest.fn(),
		};
		const compilerHelper: CompilerHelper = {
			key: 'compiler.graph',
			kind: 'compiler',
			mode: 'extend',
			priority: 0,
			dependsOn: [],
			apply: ({ output }, next) => {
				if (!next) {
					return { output };
				}
				const downstream: MaybePromise<CompilerState> = next({
					...output,
					revision: output.revision + 1,
				});
				// @ts-expect-error replacement output must be CompilerState
				next('invalid-output');
				return isPromiseLike(downstream)
					? downstream.then((finalOutput) => ({
							output: finalOutput,
						}))
					: { output: downstream };
			},
		};
		expectType<CompilerHelper>(compilerHelper);

		const pipeline = makePipeline<
			CompilerOptions,
			CompilerContext,
			CompilerReporter,
			CompilerState,
			CompilerDiagnostic,
			CompilerResult,
			CompilerKind
		>({
			helperKinds: ['compiler'],
			createContext: () => ({ reporter }),
			createState: () => ({ graph: [], revision: 0 }),
			createStages: (deps) => {
				expectType<CompilerStageDependencies>(deps);

				const helperStage = deps.makeHelperStage<
					CompilerOptions,
					CompilerState,
					CompilerKind,
					CompilerHelper
				>('compiler', {
					makeArgs: (state) => (entry) => {
						expectType<CompilerStageState>(state);
						expectType<PipelineRegisteredHelper<CompilerHelper>>(
							entry
						);
						return {
							context: state.context,
							input: state.runOptions,
							output: state.userState,
							reporter: state.reporter,
						};
					},
					writeOutput: (state, output) => {
						expectType<CompilerState>(output);
						// @ts-expect-error helper output is not a string
						expectType<string>(output);
						return { ...state, userState: output };
					},
					onVisited: (
						state,
						_visited,
						_registered,
						rollbacks,
						output
					) => {
						expectType<
							readonly PipelineHelperRollback<CompilerHelper>[]
						>(rollbacks);
						expectType<CompilerState>(output);
						return state;
					},
				});

				const replaceState: PipelineStage<
					CompilerStageState,
					CompilerResult
				> = (state) => ({
					...state,
					userState: {
						graph: [...state.userState.graph, 'compiled'],
						revision: state.userState.revision + 1,
					},
				});

				// @ts-expect-error stage state must be derived from the branded input
				const reconstructedState: CompilerStageState = {
					context: { reporter },
					reporter,
					runOptions: { source: 'post:1' },
					userState: { graph: [], revision: 0 },
					steps: [],
					diagnostics: [],
					executedLifecycles: new Set(),
				};
				void reconstructedState;

				// @ts-expect-error helper kinds are restricted to the declared union
				deps.makeHelperStage('not-a-compiler-kind');

				const invalidStage: PipelineStage<
					CompilerStageState,
					CompilerResult
					// @ts-expect-error a stage must return state, pause, or halt
				> = () => ({ invalid: true });
				void invalidStage;

				const invalidStateStage: PipelineStage<
					CompilerStageState,
					CompilerResult
					// @ts-expect-error replacement user state must remain CompilerState
				> = (state) => ({ ...state, userState: 'invalid-state' });
				void invalidStateStage;

				return [helperStage, replaceState, deps.finalizeResult];
			},
			createRunResult: ({ artifact, diagnostics, state }) => {
				expectType<CompilerState>(artifact);
				expectType<readonly CompilerDiagnostic[]>(diagnostics);
				expectType<CompilerStageState>(state);
				return { artifact, diagnostics, steps: state.steps };
			},
		});

		expectType<MaybePromise<CompilerResult>>(
			pipeline.run({ source: 'post:1' })
		);

		const assertRegistrationTypes = () => {
			// @ts-expect-error registration is restricted to configured helper kinds
			pipeline.use({ ...compilerHelper, kind: 'builder' });
		};
		void assertRegistrationTypes;
		// @ts-expect-error providedKeys is construction input, not runtime state
		void pipeline.providedKeys;
	});

	it('requires an explicit adapter for a custom run result', () => {
		makePipeline<
			CompilerOptions,
			CompilerContext,
			CompilerReporter,
			CompilerState,
			CompilerDiagnostic,
			string,
			CompilerKind
		>(
			// @ts-expect-error a custom result requires an explicit result adapter
			{
				helperKinds: ['compiler'],
				createContext: () => ({
					reporter: { trace: jest.fn() },
				}),
				createState: () => ({ graph: [], revision: 0 }),
			}
		);
	});
});
