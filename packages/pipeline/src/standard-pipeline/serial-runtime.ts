import {
	createPipeline as createNativePipeline,
	runPipeline as runNativePipeline,
} from '../v2/pipeline/runtime.js';
import type {
	EffectContract,
	GraphDeclaration,
	NodeContract,
} from '../v2/graph/types.js';
import { observeParticipant } from '../v2/scheduler/maybe-promise.js';
import type { RunPipelineResult } from '../v2/pipeline/types.js';
import {
	isSerialPipelineToken,
	readSerialProgramme,
	releaseSerialRun,
	type PreparedSerialRun,
	type SerialRunAuthority,
} from './serial-authority.js';
import {
	commitSerialEffect,
	compensateSerialEffect,
	prepareSerialEffect,
	serialBefore,
	serialNodeExecutor,
} from './serial-participant.js';
import { projectNativeOutcome } from './serial-projection.js';
import type {
	RunSerialPipelineOptions,
	SerialRunResult,
} from './serial-types.js';

const SERIAL_NODE = 'serial.compatibility';
const SERIAL_EFFECT = 'serial.evaluate';

type SerialInputs = Readonly<Record<never, never>>;
type SerialCapabilities = { readonly run: SerialRunAuthority };
type SerialNodes = Readonly<{
	readonly [SERIAL_NODE]: NodeContract<
		never,
		string,
		unknown,
		typeof SERIAL_EFFECT
	>;
}>;
type SerialEffects = Readonly<{
	readonly [SERIAL_EFFECT]: EffectContract<
		string,
		PreparedSerialRun,
		null,
		unknown
	>;
}>;
type SerialOutputs = Readonly<{ readonly result: typeof SERIAL_NODE }>;

const serialDeclaration: GraphDeclaration<
	SerialInputs,
	SerialNodes,
	readonly [],
	SerialEffects,
	SerialOutputs,
	SerialCapabilities
> = Object.freeze({
	inputKeys: Object.freeze([]),
	nodes: Object.freeze({
		[SERIAL_NODE]: Object.freeze({
			externalInputs: Object.freeze([]),
			effectKeys: Object.freeze([SERIAL_EFFECT] as const),
			priority: 0,
		}),
	}),
	edges: Object.freeze([] as const),
	effects: Object.freeze({ [SERIAL_EFFECT]: Object.freeze({}) }),
	outputs: Object.freeze({ result: SERIAL_NODE }),
	policy: Object.freeze({ maxConcurrency: 1 }),
	executors: Object.freeze({
		[SERIAL_NODE]: serialNodeExecutor,
	}),
});

const serialMiddleware = Object.freeze({
	node: SERIAL_NODE,
	before: serialBefore,
});

const serialParticipants = Object.freeze({
	[SERIAL_EFFECT]: Object.freeze({
		prepare: prepareSerialEffect,
		commit: commitSerialEffect,
		compensate: compensateSerialEffect,
	}),
});

/**
 * Runs one captured serial programme through a fresh native v2 evaluator.
 *
 * Settlement remains synchronous until a stage, hook or settlement participant
 * exposes a callable `then`. Terminal `__halt` values succeed unless they carry
 * an error; non-terminal halts and all v1 pause shapes fail validation. An abort
 * signal projects native cancellation. All admitted journal entries settle as
 * one aggregate native effect, while the returned native evidence exposes no
 * prepared callback authority.
 *
 * @param options - Programme token, run input and optional cancellation signal.
 * @returns A synchronous outcome or promise-like outcome only after genuine
 * asynchronous work is observed.
 *
 * @example
 * ```ts
 * const outcome = await runPipeline({ pipeline, options: input });
 * if (outcome.kind === 'succeeded') console.log(outcome.result);
 * ```
 * @public
 */
export function runPipeline<TRunOptions, TRunResult>(
	options: RunSerialPipelineOptions<TRunOptions, TRunResult>
): SerialRunResult<TRunResult> {
	let pipeline: unknown;
	let runOptions: unknown;
	let signal: AbortSignal | undefined;
	try {
		if (!options || typeof options !== 'object') {
			throw new TypeError('run options must be an object.');
		}
		pipeline = Reflect.get(options, 'pipeline');
		runOptions = Reflect.get(options, 'options');
		signal = Reflect.get(options, 'signal') as AbortSignal | undefined;
	} catch (error) {
		return Object.freeze({ kind: 'failed', error });
	}
	if (!isSerialPipelineToken(pipeline)) {
		return Object.freeze({
			kind: 'failed',
			error: new TypeError(
				'pipeline must be a live SerialPipeline token.'
			),
		});
	}
	const programme = readSerialProgramme(pipeline)!;
	const run: SerialRunAuthority = {
		programme,
		options: runOptions,
		...(signal ? { signal } : {}),
	};
	const native = createNativePipeline({
		declaration: serialDeclaration,
		middleware: [serialMiddleware] as const,
		participants: serialParticipants,
	});
	const result = runNativePipeline({
		pipeline: native,
		inputs: {},
		capabilities: { run },
		...(signal ? { signal } : {}),
	});
	const observed =
		observeParticipant<
			Awaited<
				RunPipelineResult<SerialNodes, SerialEffects, SerialOutputs>
			>
		>(result);
	if (observed.kind === 'failed') {
		releaseSerialRun(run.handle);
		return Object.freeze({ kind: 'failed', error: observed.error });
	}
	if (observed.kind === 'synchronous') {
		const projected = projectNativeOutcome<TRunResult>(
			observed.value,
			run.handle
		);
		releaseSerialRun(run.handle);
		return projected;
	}
	return observed.promise
		.then(
			(value) => projectNativeOutcome<TRunResult>(value, run.handle),
			(error: unknown) =>
				Object.freeze({ kind: 'failed' as const, error })
		)
		.finally(() => releaseSerialRun(run.handle));
}
