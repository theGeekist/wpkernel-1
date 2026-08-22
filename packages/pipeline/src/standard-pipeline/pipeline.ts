import type {
	Helper,
	HelperKind,
	MaybePromise,
	PipelineDiagnostic,
	PipelineReporter,
} from '../core/types.js';
import type { StandardPipelineExtension } from './extension.js';

/**
 * A configured v1 standard fragment-and-builder pipeline.
 *
 * The dedicated {@link Pipeline.ir} and {@link Pipeline.builders} surfaces
 * validate helper kinds at registration. {@link Pipeline.use} accepts either
 * configured kind while preserving the original helper object's identity.
 * Calls to {@link Pipeline.run} preserve synchronous settlement until a helper,
 * extension, commit, rollback or stage actually becomes asynchronous.
 *
 * Registrations are pipeline configuration. Each run waits for pending
 * extension registration to quiesce and captures immutable helper and hook
 * orders, so overlapping runs cannot acquire one another's later additions.
 *
 * @public
 */
export interface Pipeline<
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
> {
	/** Fragment helper kind configured for this pipeline. */
	readonly fragmentKind: TFragmentKind;
	/** Builder helper kind configured for this pipeline. */
	readonly builderKind: TBuilderKind;
	/** Typed registration surface for fragment helpers. */
	readonly ir: {
		/**
		 * Registers a fragment helper by object identity.
		 * @throws A validation error when `helper.kind` is not {@link Pipeline.fragmentKind}.
		 */
		use: (helper: TFragmentHelper) => void;
	};
	/** Typed registration surface for builder helpers. */
	readonly builders: {
		/**
		 * Registers a builder helper by object identity.
		 * @throws A validation error when `helper.kind` is not {@link Pipeline.builderKind}.
		 */
		use: (helper: TBuilderHelper) => void;
	};
	/** Extension registration surface for artifact lifecycle hooks. */
	readonly extensions: {
		/**
		 * Registers extension setup and an optional lifecycle hook.
		 *
		 * Returns synchronously for synchronous registration and a promise-like
		 * value only when registration is asynchronous. Unawaited asynchronous
		 * registration is still awaited by the next {@link Pipeline.run}.
		 */
		use: (
			extension: StandardPipelineExtension<
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
			>
		) => MaybePromise<unknown>;
	};
	/**
	 * Registers either a configured fragment helper or builder helper while
	 * preserving the original helper object's identity. Prefer {@link Pipeline.ir}
	 * or {@link Pipeline.builders} when the helper family is known statically.
	 */
	use: (helper: TFragmentHelper | TBuilderHelper) => void;
	/**
	 * Executes one isolated fragment, extension and builder sequence.
	 *
	 * Returns `TRunResult` synchronously when all participating work is
	 * synchronous; otherwise returns a promise-like value. Diagnostics belong to
	 * this invocation and do not leak into overlapping or later runs.
	 */
	run: (options: TRunOptions) => MaybePromise<TRunResult>;
}
