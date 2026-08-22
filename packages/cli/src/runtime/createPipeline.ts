import {
	createSerialPipeline,
	runPipeline,
	type CreateSerialPipelineOptions,
	type SerialPipeline,
	type SerialRunOutcome,
} from '@wpkernel/pipeline/v1';
import { WPKernelError } from '@wpkernel/core/error';
import type { FragmentIrOptions } from '../ir/publicTypes';
import {
	buildIrDraft,
	buildIrFragmentOutput,
	finalizeIrDraft,
	type MutableIr,
} from '../ir/types';
import type {
	BuilderHelper,
	BuilderInput,
	BuilderOutput,
	FragmentHelper,
	FragmentInput,
	FragmentOutput,
	Pipeline,
	PipelineContext,
	PipelineRunOptions,
	PipelineRunResult,
} from './types';
import { observeMaybePromise } from './maybePromise';

const cliProgrammeAuthorities = new WeakMap<
	object,
	SerialPipeline<PipelineRunOptions, PipelineRunResult>
>();

function buildBuilderOutput(): BuilderOutput {
	const actions: BuilderOutput['actions'] = [];
	return {
		actions,
		queueWrite(action) {
			actions.push(action);
		},
	};
}

function mapRunOptionsToBuildOptions(
	options: PipelineRunOptions
): FragmentIrOptions {
	return {
		config: options.config,
		namespace: options.namespace,
		origin: options.origin,
		sourcePath: options.sourcePath,
	} satisfies FragmentIrOptions;
}

/**
 * Creates a new CLI pipeline instance.
 *
 * This function initializes a robust code generation pipeline that processes project
 * configurations, builds an Intermediate Representation (IR), and executes various
 * builder and fragment helpers to generate code and artifacts.
 *
 * @category Runtime
 * @returns A `Pipeline` instance configured for CLI operations.
 */
export type CliPipelineOptions = CreateSerialPipelineOptions<
	PipelineRunOptions,
	FragmentIrOptions,
	PipelineContext,
	MutableIr,
	PipelineRunResult['ir'],
	PipelineRunResult,
	FragmentInput,
	FragmentOutput,
	BuilderInput,
	BuilderOutput
>;

export function createPipeline(
	overrides: Partial<CliPipelineOptions> = {}
): Pipeline {
	const defaultBuilderProvidedKeys: readonly string[] = [
		'ir.resources.core',
		'ir.capability-map.core',
		'ir.blocks.core',
		'ir.layout.core',
		'ir.meta.core',
		'ir.schemas.core',
		'ir.ordering.core',
		'ir.bundler.core',
		'ir.artifacts.plan',
		'ir.ui.core',
	];

	const programme = createSerialPipeline<
		PipelineRunOptions,
		FragmentIrOptions,
		PipelineContext,
		MutableIr,
		PipelineRunResult['ir'],
		PipelineRunResult,
		FragmentInput,
		FragmentOutput,
		BuilderInput,
		BuilderOutput
	>({
		...overrides,
		builderProvidedKeys:
			overrides.builderProvidedKeys ?? defaultBuilderProvidedKeys,
		fragments: overrides.fragments ?? [],
		builders: overrides.builders ?? [],
		extensions: overrides.extensions ?? [],
		createError(code, message) {
			// Map pipeline error codes to WPKernel ErrorCode
			const errorCode = code as
				| 'ValidationError'
				| 'DeveloperError'
				| 'UnknownError';
			return new WPKernelError(errorCode, { message });
		},
		createBuildOptions: mapRunOptionsToBuildOptions,
		createContext(runOptions) {
			return {
				workspace: runOptions.workspace,
				reporter: runOptions.reporter,
				phase: runOptions.phase,
				generationState: runOptions.generationState,
			} satisfies PipelineContext;
		},
		createFragmentState({ buildOptions }) {
			return buildIrDraft(buildOptions);
		},
		createFragmentArgs({ context, buildOptions, draft }) {
			return {
				context,
				input: {
					options: buildOptions,
					draft,
				},
				output: buildIrFragmentOutput(draft),
				reporter: context.reporter,
			} satisfies Parameters<FragmentHelper['apply']>[0];
		},
		finalizeFragmentState({ draft, helpers }) {
			return finalizeIrDraft(draft, helpers);
		},
		createBuilderArgs({ context, buildOptions, artifact }) {
			return {
				context,
				input: {
					phase: context.phase,
					options: buildOptions,
					ir: artifact,
				},
				output: buildBuilderOutput(),
				reporter: context.reporter,
			} satisfies Parameters<BuilderHelper['apply']>[0];
		},
		createRunResult({ artifact, diagnostics, steps }) {
			return {
				ir: artifact,
				diagnostics,
				steps,
			} satisfies PipelineRunResult;
		},
		onExtensionRollbackError({ error, extensionKeys, context }) {
			context.reporter.warn('Pipeline extension rollback failed.', {
				error: (error as Error).message,
				extensions: extensionKeys,
			});
		},
	});

	const pipeline: Pipeline = Object.freeze({ run: runCliPipeline });
	cliProgrammeAuthorities.set(pipeline, programme);
	return pipeline;
}

function runCliPipeline(this: Pipeline, options: PipelineRunOptions) {
	const programme = cliProgrammeAuthorities.get(this);
	if (!programme) {
		throw new TypeError('Invalid CLI Pipeline authority.');
	}
	const observed = observeMaybePromise<SerialRunOutcome<PipelineRunResult>>(
		runPipeline({ pipeline: programme, options })
	);
	if (observed.kind === 'failed') {
		throw observed.error;
	}
	return observed.kind === 'synchronous'
		? unwrapOutcome(observed.value)
		: observed.promise.then(unwrapOutcome);
}

function unwrapOutcome<TResult>(outcome: SerialRunOutcome<TResult>): TResult {
	if (outcome.kind === 'succeeded') {
		return outcome.result;
	}
	if (outcome.kind === 'failed') {
		throw outcome.error;
	}
	throw outcome.reason ?? new Error('CLI pipeline run was cancelled.');
}
