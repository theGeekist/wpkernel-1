import {
	createSerialPipeline,
	runPipeline,
	type SerialPipeline,
	type SerialRunOutcome,
} from '@wpkernel/pipeline/v1';
import { WPKernelError } from '../../error';
import { reportPipelineDiagnostic } from '../reporting';
import { generateActionRequestId } from '../../actions/context';
import { resolveActionReporter } from '../../actions/resolveReporter';
import { createActionLifecycleFragment } from './helpers/createActionLifecycleFragment';
import { createActionExecutionBuilder } from './helpers/createActionExecutionBuilder';
import { createActionOptionsResolver } from './helpers/createActionOptionsResolver';
import { createActionContextAssembler } from './helpers/createActionContextAssembler';
import { createActionRegistryRecorder } from './helpers/createActionRegistryRecorder';
import type {
	ActionPipeline,
	ActionPipelineContext,
	ActionPipelineOptions,
	ActionPipelineRunResult,
} from './types';
import { ACTION_BUILDER_KIND, ACTION_FRAGMENT_KIND } from './types';
import { getNamespace } from '../../namespace/detect';
import { observeMaybePromise } from '../helpers/maybePromise';

// Programme generics are recovered from the only domain runner admitted as the
// key. Keeping the private cell structural avoids pretending invariant run
// options can be widened to `unknown`.
const actionProgrammeAuthorities = new WeakMap<object, object>();

/**
 * Construct the action execution pipeline.
 *
 * The pipeline wires lifecycle fragments, execution builders, and diagnostics
 * as one immutable serial programme. Callers receive the narrow domain runner,
 * while helper registration remains private to programme construction.
 *
 * @example
 * ```ts
 * const pipeline = createActionPipeline<{ postId: number }, string>();
 *
 * const result = await pipeline.run({
 *   config: actionConfig,
 *   args: { postId: 42 },
 *   definition: {
 *     action: createDefinedAction(),
 *     namespace: 'example/posts',
 *   },
 * });
 *
 * console.log(result.artifact.result);
 * ```
 */
export function createActionPipeline<TArgs, TResult>(): ActionPipeline<
	TArgs,
	TResult
> {
	const pipelineOptions: ActionPipelineOptions<TArgs, TResult> = {
		fragmentKind: ACTION_FRAGMENT_KIND,
		builderKind: ACTION_BUILDER_KIND,
		createError(code, message) {
			const errorCode = code as
				| 'ValidationError'
				| 'DeveloperError'
				| 'UnknownError';
			return new WPKernelError(errorCode, { message });
		},
		createBuildOptions(runOptions) {
			return {
				config: runOptions.config,
			};
		},
		createContext(runOptions): ActionPipelineContext<TArgs, TResult> {
			const requestId = generateActionRequestId();
			const namespace = getNamespace();
			const reporter = resolveActionReporter({ namespace });

			return {
				reporter,
				actionName: runOptions.config.name,
				namespace,
				requestId,
				config: runOptions.config,
				args: runOptions.args,
				definition: runOptions.definition,
				registry: runOptions.registry,
			};
		},
		createFragmentState() {
			return {};
		},
		createFragmentArgs({ options, context, draft }) {
			return {
				context,
				input: { args: options.args },
				output: draft,
				reporter: context.reporter,
			};
		},
		finalizeFragmentState({ draft }) {
			return draft;
		},
		createBuilderArgs({ options, context, artifact }) {
			return {
				context,
				input: {
					args: options.args,
					handler: options.config.handler,
				},
				output: artifact,
				reporter: context.reporter,
			};
		},
		createRunResult({ artifact, diagnostics, steps }) {
			return {
				artifact,
				diagnostics,
				steps,
			} satisfies ActionPipelineRunResult<TResult>;
		},
		onDiagnostic({ reporter, diagnostic }) {
			reportPipelineDiagnostic({ reporter, diagnostic });
		},
		fragments: [
			createActionOptionsResolver<TArgs, TResult>(),
			createActionContextAssembler<TArgs, TResult>(),
			createActionLifecycleFragment<TArgs, TResult>(),
		],
		builders: [
			createActionExecutionBuilder<TArgs, TResult>(),
			createActionRegistryRecorder<TArgs, TResult>(),
		],
	};

	const programme = createSerialPipeline(pipelineOptions);
	const pipeline: ActionPipeline<TArgs, TResult> = Object.freeze({
		run: runActionPipeline,
	});
	actionProgrammeAuthorities.set(pipeline, programme);
	return pipeline;
}

function runActionPipeline<TArgs, TResult>(
	this: ActionPipeline<TArgs, TResult>,
	options: Parameters<ActionPipeline<TArgs, TResult>['run']>[0]
) {
	const storedProgramme = actionProgrammeAuthorities.get(this);
	if (!storedProgramme) {
		throw new TypeError('Invalid ActionPipeline authority.');
	}
	const programme = storedProgramme as SerialPipeline<
		typeof options,
		ActionPipelineRunResult<TResult>
	>;
	const observed = observeMaybePromise<
		SerialRunOutcome<ActionPipelineRunResult<TResult>>
	>(runPipeline({ pipeline: programme, options }));
	if (observed.kind === 'failed') {
		throw observed.error;
	}
	return observed.kind === 'synchronous'
		? unwrapActionOutcome(observed.value)
		: observed.promise.then(unwrapActionOutcome);
}

function unwrapActionOutcome<TResult>(
	outcome: SerialRunOutcome<TResult>
): TResult {
	if (outcome.kind === 'succeeded') {
		return outcome.result;
	}
	if (outcome.kind === 'failed') {
		throw outcome.error;
	}
	throw outcome.reason ?? new Error('Action pipeline run was cancelled.');
}
