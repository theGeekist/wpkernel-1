import type {
	Helper,
	HelperKind,
	PipelineDiagnostic,
	PipelineExtension,
	PipelineReporter,
} from '../core/types.js';
import type { Pipeline } from './pipeline.js';

/**
 * Extension descriptor specialised to a v1 fragment-and-builder pipeline.
 * Hooks receive the finalised public artifact rather than internal draft or
 * bookkeeping state.
 *
 * A hook without explicit lifecycle metadata defaults to `after-fragments`.
 * Standard pipelines schedule hooks after draft finalisation at
 * `after-fragments`, `before-builders`, `after-builders`, and `finalize`.
 * Artifact replacements are adopted before the next hook or phase. Commit and
 * rollback callbacks retain their registration identity and participate in the
 * run transaction.
 *
 * Registration may perform synchronous or asynchronous setup. A run waits for
 * registration to become quiescent, then captures an immutable registration
 * snapshot. Extensions added after that boundary participate in later runs.
 *
 * @see {@link Pipeline.extensions}
 * @public
 */
export type StandardPipelineExtension<
	TRunOptions,
	TRunResult,
	TContext extends { reporter: TReporter },
	TReporter extends PipelineReporter = PipelineReporter,
	TBuildOptions = unknown,
	TArtifact = unknown,
	TFragmentInput = unknown,
	TFragmentOutput = unknown,
	TBuilderInput = unknown,
	TBuilderOutput = unknown,
	TDiagnostic extends PipelineDiagnostic = PipelineDiagnostic,
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
> = PipelineExtension<
	Pipeline<
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
	>,
	TContext,
	TRunOptions,
	TArtifact
>;
