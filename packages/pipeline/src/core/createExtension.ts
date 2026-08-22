import { maybeThen } from './async-utils.js';
import type {
	MaybePromise,
	PipelineExtension,
	PipelineExtensionHook,
	PipelineExtensionHookRegistration,
	PipelineExtensionLifecycle,
} from './types.js';

interface CreatePipelineExtensionBaseOptions {
	/**
	 * Stable identity within one pipeline instance. Explicit keys must be unique;
	 * omitting the key asks the receiving pipeline to generate a private one.
	 */
	readonly key?: string;
}

/**
 * Dynamic extension form whose registration result decides whether and where a
 * hook is installed.
 *
 * @category Pipeline
 * @internal
 */
export interface CreatePipelineExtensionWithRegister<
	TPipeline,
	TContext,
	TOptions,
	TArtifact,
> extends CreatePipelineExtensionBaseOptions {
	/**
	 * Performs setup and returns no hook, a hook for the pipeline's default
	 * lifecycle, or an explicit lifecycle registration.
	 */
	readonly register: (
		pipeline: TPipeline
	) => MaybePromise<
		| void
		| PipelineExtensionHook<TContext, TOptions, TArtifact>
		| PipelineExtensionHookRegistration<TContext, TOptions, TArtifact>
	>;
}

interface CreatePipelineExtensionWithSetup<
	TPipeline,
	TContext,
	TOptions,
	TArtifact,
> extends CreatePipelineExtensionBaseOptions {
	/** Runs once at registration, before the static hook is resolved. */
	readonly setup?: (pipeline: TPipeline) => MaybePromise<void>;
	/** Hook or explicit lifecycle registration exposed after setup settles. */
	readonly hook?:
		| PipelineExtensionHook<TContext, TOptions, TArtifact>
		| PipelineExtensionHookRegistration<TContext, TOptions, TArtifact>;
	/** Lifecycle used for a bare hook or as fallback for a hook registration. */
	readonly lifecycle?: PipelineExtensionLifecycle;
}

/**
 * Configuration accepted by {@link createPipelineExtension}.
 *
 * The dynamic form exposes `register`, which returns zero or one hook after any
 * setup completes. The static form runs `setup` first and then exposes `hook`.
 * If a static hook registration object and the outer options both specify a
 * lifecycle, the registration object's lifecycle wins. With neither value, the
 * receiving pipeline chooses its default lifecycle.
 *
 * Both forms preserve synchronous registration when their setup is
 * synchronous. Once setup returns a structurally valid thenable, hook
 * resolution is asynchronous through {@link maybeThen}. Reading a hostile
 * `then` accessor may still fail synchronously.
 *
 * @internal
 */
export type CreatePipelineExtensionOptions<
	TPipeline,
	TContext,
	TOptions,
	TArtifact,
> =
	| CreatePipelineExtensionWithRegister<
			TPipeline,
			TContext,
			TOptions,
			TArtifact
	  >
	| CreatePipelineExtensionWithSetup<
			TPipeline,
			TContext,
			TOptions,
			TArtifact
	  >;

/**
 * Creates a {@link PipelineExtension} descriptor using either dynamic
 * registration or static setup plus hook configuration.
 *
 * Construction itself has no side effects. Calling `pipeline.extensions.use`
 * invokes the descriptor's `register` function. Explicit keys must be unique in
 * that pipeline. Omitted keys receive a private generated key. Registration is
 * admitted in `use` call order, even when asynchronous setup settles out of
 * order. A registration failure remains attached to the pipeline and rejects
 * subsequent new runs.
 *
 * Static `setup` settles before its hook is returned. Synchronous setup keeps
 * registration synchronous; asynchronous setup returns a native chained
 * promise through {@link maybeThen}. The returned descriptor is a shallow
 * object and is not frozen, so consumers should treat it as declarative
 * registration metadata rather than mutate it after `use`.
 *
 * Hooks for one lifecycle execute sequentially in registration order, each
 * receiving the artifact produced by the previous hook. A hook result may
 * replace the artifact and declare `commit` and `rollback` callbacks. Commits
 * run in hook order at an explicit commit stage or the pipeline's implicit
 * final commit. If a hook, commit or later stage fails, admitted rollbacks run
 * sequentially in reverse execution chronology. Rollback failures and rollback
 * observer failures are contained so remaining cleanup proceeds and the
 * original pipeline error stays primary.
 *
 * @param    options - Dynamic registration or static setup and hook configuration.
 * @returns An extension descriptor ready for `pipeline.extensions.use`.
 *
 * @example Conditional dynamic registration
 * ```ts
 * type HostPipeline = { helpers: { use(value: unknown): void } };
 * type Context = { reporter: PipelineReporter };
 * type RunOptions = { normalise: boolean };
 *
 * const normalise = createPipelineExtension<
 *   HostPipeline,
 *   Context,
 *   RunOptions,
 *   string[]
 * >({
 *   key: 'example.normalise',
 *   register() {
 *     return ({ artifact, options }) =>
 *       options.normalise
 *         ? { artifact: artifact.map((value) => value.trim()) }
 *         : undefined;
 *   },
 * });
 * ```
 *
 * @example Static setup with an explicit lifecycle
 * ```ts
 * type HostPipeline = { helpers: { use(value: unknown): void } };
 * type Context = { reporter: PipelineReporter };
 * type RunOptions = Record<string, never>;
 *
 * const annotate = createPipelineExtension<
 *   HostPipeline,
 *   Context,
 *   RunOptions,
 *   string[]
 * >({
 *   key: 'example.annotate',
 *   setup(pipeline) {
 *     pipeline.helpers.use({ key: 'annotation-input' });
 *   },
 *   lifecycle: 'before-builders',
 *   hook: ({ artifact }) => ({ artifact: [...artifact, 'annotated'] }),
 * });
 * ```
 *
 * @example Commit and compensating rollback
 * ```ts
 * type Context = { reporter: PipelineReporter };
 * const published = new Set<string>();
 *
 * const publish = createPipelineExtension<
 *   unknown,
 *   Context,
 *   Record<string, never>,
 *   string[]
 * >({
 *   key: 'example.publish',
 *   hook: ({ artifact }) => ({
 *     artifact,
 *     commit: () => { published.add(artifact.join(',')); },
 *     rollback: () => { published.delete(artifact.join(',')); },
 *   }),
 * });
 * ```
 *
 * @category Pipeline
 * @internal
 */
export function createPipelineExtension<
	TPipeline,
	TContext,
	TOptions,
	TArtifact,
>(
	options: CreatePipelineExtensionOptions<
		TPipeline,
		TContext,
		TOptions,
		TArtifact
	>
): PipelineExtension<TPipeline, TContext, TOptions, TArtifact> {
	if ('register' in options) {
		return {
			key: options.key,
			register: options.register,
		} satisfies PipelineExtension<TPipeline, TContext, TOptions, TArtifact>;
	}

	const { key, setup, hook, lifecycle } = options;

	return {
		key,
		register(pipeline) {
			const resolveHook = () => {
				if (!hook) {
					return undefined;
				}

				if (typeof hook === 'function') {
					if (!lifecycle) {
						return hook;
					}

					return {
						lifecycle,
						hook,
					} satisfies PipelineExtensionHookRegistration<
						TContext,
						TOptions,
						TArtifact
					>;
				}

				return {
					lifecycle: hook.lifecycle ?? lifecycle,
					hook: hook.hook,
				} satisfies PipelineExtensionHookRegistration<
					TContext,
					TOptions,
					TArtifact
				>;
			};

			return maybeThen(setup?.(pipeline), resolveHook);
		},
	} satisfies PipelineExtension<TPipeline, TContext, TOptions, TArtifact>;
}
