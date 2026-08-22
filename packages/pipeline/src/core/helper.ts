import type {
	CreateHelperOptions,
	Helper,
	HelperKind,
	HelperNext,
	PipelineReporter,
} from './types.js';

/**
 * Creates a frozen {@link Helper} descriptor from declarative registration
 * metadata and an apply function.
 *
 * The descriptor and a defensive copy of `dependsOn` are frozen. Mutating the
 * source options or dependency array after construction therefore cannot alter
 * registration identity or execution order. Objects captured by `apply` are
 * not cloned or frozen.
 *
 * Dependencies place the dependent helper later in the serial order. Among
 * otherwise unordered helpers, ordering uses descending priority, key and
 * registration order. A dependency key orders after every registered helper
 * with that key. `extend` registrations may coexist.
 * Registering an `override`
 * removes earlier helpers with the same key; a second override is rejected.
 * These modes affect registration, not how `apply` composes output.
 *
 * An apply function may mutate its supplied output and return `void`, or return
 * a result object containing an explicit replacement. The presence
 * of the `output` property is authoritative, including `{ output: undefined }`.
 * With no explicit call to {@link HelperNext}, the runner continues
 * automatically after `apply` settles and preserves the synchronous path when
 * every helper is synchronous.
 *
 * Calling `next(output?)` turns the helper into an around-continuation. It runs
 * the downstream chain once, caches that result for repeated calls and lets the
 * current helper post-process the final downstream output. A later call cannot
 * replace the input chosen by the first call. If a helper launches asynchronous
 * downstream work and then fails, the runner observes downstream settlement
 * before propagating the helper's original failure. This lets downstream
 * rollback registration finish without replacing the primary error.
 *
 * A rollback returned after successful helper settlement is admitted in helper
 * visitation order and later unwound in reverse order. Optional rollback `key`
 * and `label` fields remain accepted for source compatibility but are not
 * projected into rollback-failure evidence.
 *
 * @param    options - Helper identity, ordering metadata and apply behaviour.
 * @returns A frozen descriptor with a frozen dependency list.
 *
 * @example Immutable replacement with a dependency
 * ```ts
 * import {
 *   createHelper,
 *   type PipelineReporter,
 * } from '@wpkernel/pipeline/v1';
 *
 * type Context = { reporter: PipelineReporter };
 *
 * const normalise = createHelper<Context, string[], string[]>({
 *   key: 'normalise',
 *   kind: 'transform',
 *   dependsOn: ['parse'],
 *   priority: 20,
 *   apply: ({ output }) => ({
 *     output: output.map((value) => value.trim()),
 *   }),
 * });
 * ```
 *
 * @example Wrapping downstream execution
 * ```ts
 * import {
 *   createHelper,
 *   type PipelineReporter,
 * } from '@wpkernel/pipeline/v1';
 *
 * type Context = { reporter: PipelineReporter };
 *
 * const bracket = createHelper<Context, string[], string[]>({
 *   key: 'bracket',
 *   kind: 'transform',
 *   apply: async ({ output }, next) => {
 *     const downstream = await next?.(['before', ...output]);
 *     return { output: [...(downstream ?? output), 'after'] };
 *   },
 * });
 * ```
 *
 * @example Cleanup owned by a helper
 * ```ts
 * import {
 *   createHelper,
 *   type PipelineReporter,
 * } from '@wpkernel/pipeline/v1';
 *
 * type Context = {
 *   reporter: PipelineReporter;
 *   allocated: Set<string>;
 * };
 *
 * const allocate = createHelper<Context, void, string[]>({
 *   key: 'allocate',
 *   kind: 'build',
 *   apply: ({ context, output }) => {
 *     context.allocated.add('result');
 *     return {
 *       output: [...output, 'result'],
 *       rollback: {
 *         run: () => context.allocated.delete('result'),
 *       },
 *     };
 *   },
 * });
 * ```
 *
 * @category Pipeline
 * @public
 */
export function createHelper<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter = PipelineReporter,
	TKind extends HelperKind = HelperKind,
>(
	options: CreateHelperOptions<TContext, TInput, TOutput, TReporter, TKind>
): Helper<TContext, TInput, TOutput, TReporter, TKind> {
	const {
		key,
		kind,
		mode = 'extend',
		priority = 0,
		dependsOn = [],
		origin,
		apply,
	} = options;

	const descriptor: Helper<TContext, TInput, TOutput, TReporter, TKind> =
		Object.freeze({
			key,
			kind,
			mode,
			priority,
			dependsOn: Object.freeze(Array.from(dependsOn)),
			origin,
			apply(
				runtimeOptions: Parameters<
					Helper<TContext, TInput, TOutput, TReporter, TKind>['apply']
				>[0],
				next?: HelperNext<TOutput>
			) {
				return apply(runtimeOptions, next);
			},
		});

	return descriptor;
}
