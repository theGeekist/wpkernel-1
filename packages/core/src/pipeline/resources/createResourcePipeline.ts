import {
	createSerialPipeline,
	runPipeline,
	type SerialPipeline,
	type SerialRunOutcome,
} from '@wpkernel/pipeline/v1';
import { WPKernelError } from '../../error';
import { reportPipelineDiagnostic } from '../reporting';
import { createResourceValidationFragment } from './helpers/createResourceValidationFragment';
import { createResourceClientFragment } from './helpers/createResourceClientFragment';
import { createResourceCacheKeysFragment } from './helpers/createResourceCacheKeysFragment';
import { createResourceObjectBuilder } from './helpers/createResourceObjectBuilder';
import { createFinalizeResourceDefinitionExtension } from './extensions/createFinalizeResourceDefinitionExtension';
import type {
	ResourcePipeline,
	ResourcePipelineOptions,
	ResourcePipelineRunResult,
} from './types';
import { RESOURCE_BUILDER_KIND, RESOURCE_FRAGMENT_KIND } from './types';
import { observeMaybePromise } from '../helpers/maybePromise';

// Programme generics are recovered from the only domain runner admitted as the
// key. Keeping the private cell structural avoids pretending invariant run
// options can be widened to `unknown`.
const resourceProgrammeAuthorities = new WeakMap<object, object>();

/**
 * Construct the resource pipeline responsible for validating configuration,
 * producing cache keys, creating clients, and building the final resource
 * object.
 *
 * @example
 * ```ts
 * const pipeline = createResourcePipeline<Post, { id: number }>();
 * const result = await pipeline.run({
 *   config: resourceConfig,
 *   normalizedConfig,
 *   namespace: 'example/resources',
 *   resourceName: 'Post',
 *   reporter,
 * });
 *
 * console.log(result.artifact.resource?.get.one({ id: 42 }));
 * ```
 */
export function createResourcePipeline<T, TQuery>(): ResourcePipeline<
	T,
	TQuery
> {
	const pipelineOptions: ResourcePipelineOptions<T, TQuery> = {
		fragmentKind: RESOURCE_FRAGMENT_KIND,
		builderKind: RESOURCE_BUILDER_KIND,
		createError(code, message) {
			const errorCode = code as
				| 'ValidationError'
				| 'DeveloperError'
				| 'UnknownError';
			return new WPKernelError(errorCode, { message });
		},
		createBuildOptions(runOptions) {
			return { ...runOptions };
		},
		createContext(runOptions) {
			return {
				...runOptions,
				storeKey: `${runOptions.namespace}/${runOptions.resourceName}`,
			};
		},
		createFragmentState() {
			return {};
		},
		createFragmentArgs({ options, context, draft }) {
			return {
				context,
				input: options.config,
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
				input: options.config,
				output: artifact,
				reporter: context.reporter,
			};
		},
		createRunResult({ artifact, diagnostics, steps }) {
			return {
				artifact,
				diagnostics,
				steps,
			} satisfies ResourcePipelineRunResult<T, TQuery>;
		},
		onDiagnostic({ reporter, diagnostic }) {
			reportPipelineDiagnostic({ reporter, diagnostic });
		},
		fragments: [
			createResourceValidationFragment<T, TQuery>(),
			createResourceClientFragment<T, TQuery>(),
			createResourceCacheKeysFragment<T, TQuery>(),
		],
		builders: [createResourceObjectBuilder<T, TQuery>()],
		extensions: [createFinalizeResourceDefinitionExtension<T, TQuery>()],
	};

	const programme = createSerialPipeline(pipelineOptions);
	const pipeline: ResourcePipeline<T, TQuery> = Object.freeze({
		run: runResourcePipeline,
	});
	resourceProgrammeAuthorities.set(pipeline, programme);
	return pipeline;
}

function runResourcePipeline<T, TQuery>(
	this: ResourcePipeline<T, TQuery>,
	options: Parameters<ResourcePipeline<T, TQuery>['run']>[0]
) {
	const storedProgramme = resourceProgrammeAuthorities.get(this);
	if (!storedProgramme) {
		throw new TypeError('Invalid ResourcePipeline authority.');
	}
	const programme = storedProgramme as SerialPipeline<
		typeof options,
		ResourcePipelineRunResult<T, TQuery>
	>;
	const observed = observeMaybePromise<
		SerialRunOutcome<ResourcePipelineRunResult<T, TQuery>>
	>(runPipeline({ pipeline: programme, options }));
	if (observed.kind === 'failed') {
		throw observed.error;
	}
	return observed.kind === 'synchronous'
		? unwrapResourceOutcome(observed.value)
		: observed.promise.then(unwrapResourceOutcome);
}

function unwrapResourceOutcome<TResult>(
	outcome: SerialRunOutcome<TResult>
): TResult {
	if (outcome.kind === 'succeeded') {
		return outcome.result;
	}
	if (outcome.kind === 'failed') {
		throw outcome.error;
	}
	throw outcome.reason ?? new Error('Resource pipeline run was cancelled.');
}
