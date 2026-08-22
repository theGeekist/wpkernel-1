import type { HelperExecutionSnapshot, HelperKind } from '../core/types.js';

/**
 * Execution metadata available when a serial compatibility programme finalises
 * its draft.
 *
 * The snapshot describes the configured fragment kind and the helpers that
 * were registered, executed, or excluded because dependencies were missing.
 * @public
 */
export interface FragmentFinalizationMetadata<
	TFragmentKind extends HelperKind = HelperKind,
> {
	/** Snapshot of fragment helper resolution and execution for this run. */
	readonly fragments: HelperExecutionSnapshot<TFragmentKind>;
}

/**
 * Complete helper execution metadata supplied to a custom run-result adapter.
 *
 * Fragment metadata is captured before draft finalisation. Builder metadata is
 * captured after the final builder helper and therefore describes the whole
 * serial compatibility helper sequence.
 * @public
 */
export interface PipelineExecutionMetadata<
	TFragmentKind extends HelperKind = HelperKind,
	TBuilderKind extends HelperKind = HelperKind,
> extends FragmentFinalizationMetadata<TFragmentKind> {
	/** Snapshot of builder helper resolution and execution for this run. */
	readonly builders: HelperExecutionSnapshot<TBuilderKind>;
}
