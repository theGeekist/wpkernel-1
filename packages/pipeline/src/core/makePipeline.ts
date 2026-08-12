import { createPipelineRuntime } from './pipeline-runtime';
import { initAgnosticRunner } from './runner';
import type {
	AgnosticPipeline,
	AgnosticPipelineOptions,
	HelperKind,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
} from './types';

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
): AgnosticPipeline<TRunOptions, TRunResult, TContext, TReporter> {
	const runtime = createPipelineRuntime(options);
	const runner = initAgnosticRunner(runtime.runnerDependencies);

	const pipeline: AgnosticPipeline<
		TRunOptions,
		TRunResult,
		TContext,
		TReporter
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
