import { createPipelineRuntime } from './pipeline-runtime.js';
import { initAgnosticRunner } from './runner/index.js';
import type {
	AgnosticPipeline,
	AgnosticPipelineOptions,
	HelperKind,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
} from './types.js';

/**
 * Creates an agnostic pipeline whose helper kinds, state and stage
 * sequence are supplied by {@link AgnosticPipelineOptions}.
 *
 * Without `createStages`, the runner executes one helper stage for each
 * `helperKinds` entry in declaration order, commits extension work, and
 * materialises the result. A custom stage factory can interleave typed helper
 * stages, extension lifecycle stages, commit checkpoints and custom state
 * transformations. Only configured helper kinds can be registered.
 *
 * `createState` owns the run's initial user state. Helper-stage `writeOutput`
 * functions and custom stages control subsequent state adoption.
 * `createRunResult` adapts final user state, diagnostics, steps, context and run
 * options into a domain result. Without it, the result is
 * {@link PipelineRunState}.
 *
 * Helper and extension registration are pipeline configuration. Extension
 * registration may be synchronous or asynchronous, and registration can add
 * helpers. Each run waits until registration becomes quiescent, then captures
 * immutable helper orders and hooks. Additions after that boundary affect later
 * runs. A registration failure invalidates the pipeline instance and is
 * observed by every later run.
 *
 * Diagnostics belong to one invocation. The diagnostic observer may stream
 * them through that invocation's reporter, but observer failures are contained.
 * Rollback failures are also reported without replacing the original run
 * failure or preventing remaining cleanup.
 *
 * Execution preserves synchronous settlement. The returned pipeline's `run`
 * returns a plain result until a participating registration, helper, extension,
 * commit, rollback or custom stage becomes asynchronous.
 *
 * @example A custom lifecycle around one helper kind
 * ```ts
 * const pipeline = makePipeline({
 *   helperKinds: ['compile'] as const,
 *   createContext: () => ({ reporter: console }),
 *   createState: () => ({ output: '' }),
 *   extensions: { lifecycles: ['after-compile'] },
 *   createStages: (stages) => [
 *     stages.makeHelperStage('compile'),
 *     stages.makeLifecycleStage('after-compile'),
 *     stages.finalizeResult,
 *   ],
 * });
 *
 * pipeline.use(compileHelper);
 * const result = await pipeline.run({});
 * ```
 *
 * @param options - Context, state, stages, helper kinds and observer factories.
 * @returns A configured agnostic pipeline instance.
 * @internal
 */
export function makePipeline<
	TRunOptions,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TUserState = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
	TRunResult = PipelineRunState<TUserState, TDiagnostic>,
	TKind extends HelperKind = HelperKind,
>(
	options: AgnosticPipelineOptions<
		TRunOptions,
		TContext,
		TReporter,
		TUserState,
		TDiagnostic,
		TRunResult,
		TKind
	>
): AgnosticPipeline<TRunOptions, TRunResult, TContext, TReporter, TKind> {
	const runtime = createPipelineRuntime(options);
	const runner = initAgnosticRunner(runtime.runnerDependencies);

	const pipeline: AgnosticPipeline<
		TRunOptions,
		TRunResult,
		TContext,
		TReporter,
		TKind
	> = {
		extensions: {
			use: (extension) => runtime.registerExtension(pipeline, extension),
		},
		use: (helper) => runtime.registerHelper(helper),
		run: (runOptions) =>
			runtime.afterRegistrations(() =>
				runner.executeRun(runner.prepareContext(runOptions))
			),
	};

	return pipeline;
}
