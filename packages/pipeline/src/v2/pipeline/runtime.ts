import {
	compileGraphExtensionGeneration,
	createGraphExtensionGeneration,
} from '../extensions/generation.js';
import type {
	GraphExtension,
	GraphExtensionCompilation,
} from '../extensions/types.js';
import type {
	Edge,
	EffectRegistry,
	GraphContribution,
	GraphValue,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';
import { inspectRecord } from '../graph/inspection.js';
import type { RunObserver } from '../observers/types.js';
import type { GraphSchedulerError } from '../scheduler/errors.js';
import { createGraphSchedulerError } from '../scheduler/errors.js';
import { ownGraphInputSnapshot } from '../scheduler/ownership.js';
import { scheduleOwnedGraph } from '../scheduler/schedule.js';
import type { ErasedRunOutcome } from '../scheduler/state.js';
import { attachPipelineBrand } from './brand.js';
import {
	collectPipelineRoleFailures,
	ownPipelineRoles,
	type OwnedPipelineMiddleware,
} from './ownership.js';
import type {
	CreatePipelineOptions,
	Pipeline,
	PipelineAdmissionFailure,
	PipelineConfigurationFailure,
	PipelineConfigurationIssue,
	PipelineEdges,
	PipelineNodes,
	PipelineProjection,
	RunPipelineOptions,
	RunPipelineResult,
} from './types.js';

type RoleFailure = Extract<
	PipelineConfigurationIssue,
	{ readonly kind: 'role' }
>;

interface PipelineAuthority {
	readonly generation: ReturnType<typeof createGraphExtensionGeneration>;
	readonly middleware: readonly OwnedPipelineMiddleware[];
	readonly observers: readonly RunObserver[];
	readonly participants: Readonly<Record<string, unknown>>;
	readonly roleFailures: readonly RoleFailure[];
}

const pipelineAuthorities = new WeakMap<object, PipelineAuthority>();

type ErasedPublicRunResult = RunPipelineResult<
	NodeRegistry,
	EffectRegistry,
	OutputProjection<NodeRegistry>
>;

const captureCreateFields = (value: unknown): ReadonlyMap<string, unknown> => {
	try {
		const inspected = inspectRecord(value);
		if (!inspected.ok) {
			return new Map();
		}
		return new Map(
			inspected.value.map(
				({ key, value: field }) => [key, field] as const
			)
		);
	} catch {
		return new Map();
	}
};

const createToken = (authority: PipelineAuthority): object => {
	const token = Object.assign(
		Object.create(null) as Record<PropertyKey, unknown>,
		{ kind: 'pipeline' as const }
	);
	attachPipelineBrand(token);
	Object.freeze(token);
	pipelineAuthorities.set(token, authority);
	return token;
};

/**
 * Creates one immutable configured evaluator without a method facade.
 *
 * Extension callbacks are captured before any is invoked. Their configuration
 * is owned first, and each callback runs exactly once in tuple order. Creating
 * a different configuration means creating a different Pipeline token.
 *
 * Creation owns and freezes the graph declaration, captures registrations and
 * invokes each extension contribution. It performs no graph compilation or
 * execution and claims no durable or cross-process authority.
 *
 * @param options - Complete evaluator configuration to capture.
 * @returns A frozen process-local Pipeline token.
 * @public
 */
export function createPipeline<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	const TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	const TParticipants extends Readonly<Record<PropertyKey, unknown>>,
	const TExtensions extends readonly {
		readonly extension: GraphExtension<never, GraphContribution>;
		readonly configuration: GraphValue;
	}[] = readonly [],
	const TMiddleware extends readonly object[] = readonly [],
>(
	options: CreatePipelineOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities,
		TExtensions,
		TParticipants,
		TMiddleware
	>
): Pipeline<
	TInputs,
	PipelineNodes<TNodes, TExtensions>,
	PipelineEdges<TEdges, TExtensions>,
	TEffects,
	PipelineProjection<TNodes, TProjection, TExtensions>,
	TCapabilities
>;
export function createPipeline(options: unknown): object {
	const fields = captureCreateFields(options);
	const roles = ownPipelineRoles({
		middleware: fields.get('middleware'),
		observers: fields.get('observers'),
		participants: fields.get('participants'),
	});
	return createToken(
		Object.freeze({
			generation: createGraphExtensionGeneration({
				declaration: fields.get('declaration'),
				registrations: fields.get('extensions'),
			}),
			middleware: roles.middleware,
			observers: roles.observers,
			participants: roles.participants,
			roleFailures: roles.failures,
		})
	);
}

const isGraphSchedulerError = (value: unknown): value is GraphSchedulerError =>
	value instanceof Error &&
	value.name === 'GraphSchedulerError' &&
	typeof Reflect.get(value, 'code') === 'string';

const admissionFailure = (options: {
	readonly field: PipelineAdmissionFailure['field'];
	readonly error: GraphSchedulerError;
}): PipelineAdmissionFailure =>
	Object.freeze({
		kind: 'admission-failed',
		field: options.field,
		error: options.error,
	});

const admissionError = (options: {
	readonly field: PipelineAdmissionFailure['field'];
	readonly code: GraphSchedulerError['code'];
	readonly message: string;
	readonly cause?: unknown;
}): PipelineAdmissionFailure =>
	admissionFailure({
		field: options.field,
		error: createGraphSchedulerError({
			code: options.code,
			message: options.message,
			...(options.cause === undefined ? {} : { cause: options.cause }),
		}),
	});

const configurationFailure = (options: {
	readonly compilation: GraphExtensionCompilation;
	readonly roleFailures: readonly RoleFailure[];
}): PipelineConfigurationFailure => {
	const extensionIssues = options.compilation.extensionFailures.map(
		(failure) => Object.freeze({ kind: 'extension' as const, failure })
	);
	const graphIssues = options.compilation.graphDiagnostics.map((diagnostic) =>
		Object.freeze({ kind: 'graph' as const, diagnostic })
	);
	const failures = Object.freeze<PipelineConfigurationIssue[]>([
		...extensionIssues,
		...graphIssues,
		...options.roleFailures,
	]);
	return Object.freeze({
		kind: 'configuration-failed',
		primaryFailure: failures[0]!,
		failures,
		extensionFailures: options.compilation.extensionFailures,
		graphDiagnostics: options.compilation.graphDiagnostics,
		roleFailures: Object.freeze([...options.roleFailures]),
	});
};

const evaluateCompilation = (options: {
	readonly authority: PipelineAuthority;
	readonly compilation: GraphExtensionCompilation;
	readonly inputs: Readonly<Record<string, GraphValue>>;
	readonly capabilities: unknown;
	readonly signal?: AbortSignal;
}):
	| PipelineAdmissionFailure
	| PipelineConfigurationFailure
	| ErasedRunOutcome<EffectRegistry>
	| Promise<ErasedRunOutcome<EffectRegistry>> => {
	const graphRoleFailures = collectPipelineRoleFailures({
		nodeKeys: options.compilation.configurationSurface.nodeKeys,
		effectKeys: options.compilation.configurationSurface.effectKeys,
		middleware: options.authority.middleware,
		participants: options.authority.participants,
	});
	const roleFailures = Object.freeze([
		...options.authority.roleFailures,
		...graphRoleFailures,
	]);
	if (
		options.compilation.extensionFailures.length > 0 ||
		options.compilation.kind === 'invalid' ||
		roleFailures.length > 0
	) {
		return configurationFailure({
			compilation: options.compilation,
			roleFailures,
		});
	}
	try {
		return scheduleOwnedGraph({
			graph: options.compilation.graph,
			inputs: options.inputs,
			capabilities: options.capabilities,
			participants: options.authority.participants,
			middleware: options.authority.middleware.map(
				({ registration }) => registration
			),
			observers: options.authority.observers,
			...(options.signal === undefined ? {} : { signal: options.signal }),
		}) as
			| ErasedRunOutcome<EffectRegistry>
			| Promise<ErasedRunOutcome<EffectRegistry>>;
	} catch (error) {
		if (!isGraphSchedulerError(error) || error.code !== 'invalid-input') {
			throw error;
		}
		return admissionFailure({ field: 'inputs', error });
	}
};

interface PendingEvaluation {
	readonly authority: PipelineAuthority;
	readonly inputs: Readonly<Record<string, GraphValue>>;
	readonly capabilities: unknown;
	readonly signal?: AbortSignal;
}

const evaluatePending = (
	values: readonly [GraphExtensionCompilation, PendingEvaluation]
): ReturnType<typeof evaluateCompilation> =>
	evaluateCompilation({
		authority: values[1].authority,
		compilation: values[0],
		inputs: values[1].inputs,
		capabilities: values[1].capabilities,
		...(values[1].signal === undefined ? {} : { signal: values[1].signal }),
	});

interface CapturedRunFields {
	readonly pipeline: unknown;
	readonly inputs: unknown;
	readonly capabilities: unknown;
	readonly signal: unknown;
}

type RunFieldCapture =
	| { readonly ok: true; readonly value: CapturedRunFields }
	| { readonly ok: false; readonly failure: PipelineAdmissionFailure };

const runFieldNames = ['pipeline', 'inputs', 'capabilities', 'signal'] as const;

const captureRunFields = (value: unknown): RunFieldCapture => {
	if (!value || typeof value !== 'object') {
		return {
			ok: false,
			failure: admissionError({
				field: 'options',
				code: 'invalid-input',
				message: 'Pipeline run options must be an inspectable record.',
			}),
		};
	}
	try {
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) {
			throw new TypeError('Pipeline run options must be a plain record.');
		}
	} catch (cause) {
		return {
			ok: false,
			failure: admissionError({
				field: 'options',
				code: 'invalid-input',
				message: 'Pipeline run options must be an inspectable record.',
				cause,
			}),
		};
	}
	const captured: Partial<Record<(typeof runFieldNames)[number], unknown>> =
		{};
	for (const field of runFieldNames) {
		try {
			captured[field] = Reflect.get(value, field);
		} catch (cause) {
			return {
				ok: false,
				failure: admissionError({
					field,
					code:
						field === 'pipeline'
							? 'invalid-graph'
							: 'invalid-input',
					message: `Pipeline run ${field} could not be read.`,
					cause,
				}),
			};
		}
	}
	return {
		ok: true,
		value: Object.freeze(captured) as unknown as CapturedRunFields,
	};
};

const invalidRunSignal = (value: unknown): GraphSchedulerError | undefined => {
	if (value === undefined) {
		return undefined;
	}
	try {
		const getter = Object.getOwnPropertyDescriptor(
			AbortSignal.prototype,
			'aborted'
		)?.get;
		if (typeof getter !== 'function') {
			throw new TypeError('AbortSignal brand is unavailable.');
		}
		Reflect.apply(getter, value, []);
		return undefined;
	} catch (cause) {
		return createGraphSchedulerError({
			code: 'invalid-input',
			message: 'Pipeline run signal must be an AbortSignal.',
			cause,
		});
	}
};

/**
 * Compiles and evaluates one fresh run through the sole public lifecycle operation.
 *
 * Every configuration issue is collected before executable role compilers run.
 * On success, ready nodes are admitted by canonical graph order; timing does
 * not choose outputs, the primary failure or effect commit order. The return is
 * synchronous unless a participating return exposes a callable `then`.
 *
 * Pipeline owns only this process-local evaluation. Durable admission, leases,
 * crash recovery, portable checkpoints and exactly-once external effects are
 * host responsibilities.
 *
 * @param options              - Pipeline token and run-local admission values.
 * @param options.pipeline     - Live process-local evaluator authority.
 * @param options.inputs       - Complete caller-owned external input record.
 * @param options.capabilities - Run-local capabilities passed to every node.
 * @param options.signal       - Optional cancellation signal for this run.
 * @returns Configuration evidence, admission evidence or a terminal run outcome.
 * @public
 */
export function runPipeline<
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
>(
	options: RunPipelineOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>
): RunPipelineResult<TNodes, TEffects, TProjection>;
export function runPipeline(options: unknown): ErasedPublicRunResult {
	const captured = captureRunFields(options);
	if (!captured.ok) {
		return captured.failure;
	}
	const authority =
		captured.value.pipeline && typeof captured.value.pipeline === 'object'
			? pipelineAuthorities.get(captured.value.pipeline)
			: undefined;
	if (!authority) {
		return admissionError({
			field: 'pipeline',
			code: 'invalid-graph',
			message:
				'Pipeline is not a live process-local evaluator authority.',
		});
	}
	const inputs = ownGraphInputSnapshot({ value: captured.value.inputs });
	if (!inputs.ok) {
		return admissionFailure({
			field: 'inputs',
			error: inputs.error,
		});
	}
	const signalError = invalidRunSignal(captured.value.signal);
	if (signalError) {
		return admissionFailure({
			field: 'signal',
			error: signalError,
		});
	}
	const compiled = compileGraphExtensionGeneration(authority.generation);
	const pending = Object.freeze({
		authority,
		inputs: inputs.value,
		capabilities: captured.value.capabilities,
		...(captured.value.signal === undefined
			? {}
			: { signal: captured.value.signal as AbortSignal }),
	});
	return (
		compiled instanceof Promise
			? Promise.all([compiled, pending]).then(evaluatePending)
			: evaluatePending([compiled, pending])
	) as ErasedPublicRunResult;
}
