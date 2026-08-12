import type {
	Helper,
	HelperApplyResult,
	HelperApplyOptions,
	HelperKind,
	HelperNext,
	MaybePromise,
	PipelineReporter,
} from './types';
import type { RegisteredHelper } from './dependency-graph';
import { adoptMaybePromise, maybeThen } from './async-utils';

export interface HelperExecutionResult<TOutput> {
	readonly visited: Set<string>;
	readonly hasOutput: boolean;
	readonly output: TOutput;
}

interface OutputState<TOutput> {
	readonly hasOutput: boolean;
	readonly output: TOutput;
}

type ContinuationState<TOutput> =
	| { readonly status: 'idle' }
	| {
			readonly status: 'pending';
			readonly result: Promise<TOutput>;
	  }
	| {
			readonly status: 'fulfilled';
			readonly output: TOutput;
	  }
	| {
			readonly status: 'rejected';
			readonly error: unknown;
	  };

const hasReturnedOutput = <TOutput>(
	result: HelperApplyResult<TOutput> | void
): result is HelperApplyResult<TOutput> & { readonly output: TOutput } =>
	Boolean(result && typeof result === 'object' && 'output' in result);

/**
 * Executes an ordered list of helpers sequentially with middleware-style `next()` support.
 *
 * Each helper can optionally call `next(output?)` to explicitly control when the next helper runs and receive the final downstream output.
 * If a helper doesn't call `next()`, execution continues automatically after the helper completes
 * (for async helpers, after the promise resolves).
 *
 * This enables middleware patterns where helpers can:
 * - Pre-process or replace output before calling next()
 * - Post-process the output returned by next()
 * - Control timing of downstream execution via explicit next() calls
 *
 * @param ordered    - Topologically sorted helpers to execute
 * @param makeArgs   - Factory function to create arguments for each helper
 * @param invoke     - Function that invokes a helper with its arguments and next callback
 * @param recordStep - Callback invoked when a helper starts executing (for diagnostics)
 * @returns Visited helper IDs and the final transformed output
 *
 * @internal
 */
export function executeHelpers<
	TContext,
	TInput,
	TOutput,
	TReporter extends PipelineReporter,
	TKind extends HelperKind,
	THelper extends Helper<TContext, TInput, TOutput, TReporter, TKind>,
	TArgs extends HelperApplyOptions<TContext, TInput, TOutput, TReporter>,
>(
	ordered: RegisteredHelper<THelper>[],
	makeArgs: (entry: RegisteredHelper<THelper>) => TArgs,
	invoke: (
		helper: THelper,
		args: TArgs,
		next: HelperNext<TOutput>,
		executionIndex: number
	) => MaybePromise<HelperApplyResult<TOutput> | void>,
	recordStep: (entry: RegisteredHelper<THelper>) => void
): MaybePromise<HelperExecutionResult<TOutput>> {
	const visited = new Set<string>();

	const resolveInvocation = (
		result: HelperApplyResult<TOutput> | void,
		current: OutputState<TOutput>,
		index: number,
		continuation: ContinuationState<TOutput>
	): MaybePromise<OutputState<TOutput>> => {
		const returnedOutput = hasReturnedOutput(result)
			? {
					hasOutput: true,
					output: result.output,
				}
			: {
					hasOutput: current.hasOutput,
					output: current.output,
				};

		if (continuation.status === 'idle') {
			return runAt(index + 1, returnedOutput);
		}

		if (continuation.status === 'pending') {
			return continuation.result.then((output) =>
				hasReturnedOutput(result)
					? returnedOutput
					: {
							hasOutput: true,
							output,
						}
			);
		}

		if (continuation.status === 'fulfilled') {
			return hasReturnedOutput(result)
				? returnedOutput
				: {
						hasOutput: true,
						output: continuation.output,
					};
		}

		if (continuation.status === 'rejected') {
			if (hasReturnedOutput(result)) {
				return returnedOutput;
			}
			throw continuation.error;
		}

		throw new Error('Unhandled helper continuation state.');
	};

	function runAt(
		index: number,
		incoming?: OutputState<TOutput>
	): MaybePromise<OutputState<TOutput>> {
		if (index >= ordered.length) {
			return (
				incoming ?? {
					hasOutput: false,
					output: undefined as TOutput,
				}
			);
		}

		const entry = ordered[index];
		if (!entry) {
			return runAt(index + 1, incoming);
		}

		if (visited.has(entry.id)) {
			return runAt(index + 1, incoming);
		}

		visited.add(entry.id);
		recordStep(entry);

		const baseArgs = makeArgs(entry);
		const current: OutputState<TOutput> = incoming?.hasOutput
			? incoming
			: {
					hasOutput: Object.prototype.hasOwnProperty.call(
						baseArgs,
						'output'
					),
					output: baseArgs.output,
				};
		const args = {
			...baseArgs,
			output: current.output,
		} as TArgs;

		let continuation: ContinuationState<TOutput> = { status: 'idle' };
		const next: HelperNext<TOutput> = function (
			...nextArgs: [] | [TOutput]
		): MaybePromise<TOutput> {
			if (continuation.status === 'pending') {
				return continuation.result;
			}
			if (continuation.status === 'fulfilled') {
				return continuation.output;
			}
			if (continuation.status === 'rejected') {
				throw continuation.error;
			}

			const nextOutput =
				nextArgs.length === 0 ? current.output : nextArgs[0];

			try {
				const downstream = runAt(index + 1, {
					hasOutput: true,
					output: nextOutput,
				});

				const adoptedDownstream = adoptMaybePromise(downstream);
				if (adoptedDownstream.promise !== null) {
					const pending = adoptedDownstream.promise.then(
						(result) => {
							continuation = {
								status: 'fulfilled',
								output: result.output,
							};
							return result.output;
						},
						(error: unknown) => {
							continuation = { status: 'rejected', error };
							throw error;
						}
					);
					continuation = { status: 'pending', result: pending };
					return pending;
				}

				continuation = {
					status: 'fulfilled',
					output: adoptedDownstream.value.output,
				};
				return adoptedDownstream.value.output;
			} catch (error) {
				continuation = { status: 'rejected', error };
				throw error;
			}
		};

		return maybeThen(invoke(entry.helper, args, next, index), (result) =>
			resolveInvocation(result, current, index, continuation)
		);
	}

	return maybeThen(runAt(0), (result) => ({
		visited,
		hasOutput: result.hasOutput,
		output: result.output,
	}));
}
