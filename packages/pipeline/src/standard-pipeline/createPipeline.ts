/**
 * Creates the standard fragment-and-builder pipeline described by
 * `CreatePipelineOptions`.
 *
 * The pipeline executes fragment helpers, finalises their draft, runs
 * `after-fragments` and `before-builders` extension hooks, executes builder
 * helpers, runs `after-builders` and `finalize` hooks, commits admitted
 * extension work, and materialises the configured result.
 *
 * Synchronous helpers and hooks produce a synchronous result. The return value
 * becomes promise-like only when participating work is asynchronous. Pending
 * asynchronous extension registration is always awaited before a run captures
 * its immutable configuration.
 *
 * @example
 * ```ts
 * import { createPipeline } from '@wpkernel/pipeline';
 *
 * const pipeline = createPipeline({
 *   createBuildOptions: () => ({}),
 *   createContext: () => ({ reporter: console }),
 *   createFragmentState: () => [] as string[],
 *   createFragmentArgs: ({ context, draft }) => ({
 *     context,
 *     input: undefined,
 *     output: draft,
 *     reporter: context.reporter,
 *   }),
 *   finalizeFragmentState: ({ draft }) => ({ entries: draft }),
 *   createBuilderArgs: ({ context, artifact }) => ({
 *     context,
 *     input: undefined,
 *     output: artifact,
 *     reporter: context.reporter,
 *   }),
 * });
 *
 * const result = await pipeline.run({});
 * ```
 *
 * @public
 */
export { createStandardPipeline as createPipeline } from './runner/index.js';
