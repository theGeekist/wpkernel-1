import { createPipelineRuntime } from './pipeline-runtime';
import { initAgnosticResumableRunner } from './runner';
import type { AgnosticState } from './runner/types';
import type {
	AgnosticPipelineOptions,
	HelperKind,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineRunState,
	ResumablePipeline,
} from './types';

export function makeResumablePipeline<
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
): ResumablePipeline<
	TRunOptions,
	TRunResult,
	TContext,
	TReporter,
	AgnosticState<TRunOptions, TUserState, TContext, TReporter, TDiagnostic>
> {
	type PipelineState = AgnosticState<
		TRunOptions,
		TUserState,
		TContext,
		TReporter,
		TDiagnostic
	>;

	const runtime = createPipelineRuntime(options, { supportsPause: true });
	const runner = initAgnosticResumableRunner(runtime.runnerDependencies);

	const pipeline: ResumablePipeline<
		TRunOptions,
		TRunResult,
		TContext,
		TReporter,
		PipelineState
	> = {
		extensions: {
			use: (extension) => runtime.registerExtension(pipeline, extension),
		},
		use: (helper) => runtime.registerHelper(helper),
		run: (runOptions) =>
			runtime.afterRegistrations(() =>
				runner.executeRun(runner.prepareContext(runOptions))
			),
		resume: (snapshot, resumeInput) =>
			runtime.afterRegistrations(() =>
				runner.executeResume(snapshot, resumeInput)
			),
	};

	return pipeline;
}
