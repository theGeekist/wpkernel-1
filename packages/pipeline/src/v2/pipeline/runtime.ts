import {
	compileGraphExtensionGeneration,
	createGraphExtensionGeneration,
} from '../extensions/generation.js';
import type {
	GraphExtensionCompilation,
	GraphExtensionRegistrationShape,
} from '../extensions/types.js';
import type {
	Edge,
	EffectRegistry,
	GraphValue,
	NodeRegistry,
	OutputProjection,
} from '../graph/types.js';
import { inspectRecord } from '../graph/inspection.js';
import type { NodeMiddlewareRegistration } from '../middleware/types.js';
import type { RunObserver } from '../observers/types.js';
import type { GraphSchedulerError } from '../scheduler/errors.js';
import { createGraphSchedulerError } from '../scheduler/errors.js';
import { ownGraphInputSnapshot } from '../scheduler/ownership.js';
import { scheduleOwnedGraph } from '../scheduler/schedule.js';
import type { ErasedRunOutcome } from '../scheduler/state.js';
import { attachPipelineBrand } from './brand.js';
import type { pipelineBrand } from './brand.js';
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

interface PipelineShape {
	readonly [pipelineBrand]: {
		readonly inputs: { readonly value: unknown };
		readonly nodes: { readonly value: unknown };
		readonly effects: { readonly value: unknown };
		readonly outputs: { readonly value: unknown };
		readonly capabilities: { readonly value: unknown };
	};
	readonly kind: 'pipeline';
}

type PipelineWitnessValue<
	TPipeline,
	TKey extends keyof PipelineShape[typeof pipelineBrand],
> = TPipeline extends PipelineShape
	? Exclude<
			TPipeline[typeof pipelineBrand][TKey] extends {
				readonly value: infer TValue;
			}
				? TValue
				: never,
			undefined
		>
	: never;

type PipelineInputOf<TPipeline> =
	PipelineWitnessValue<TPipeline, 'inputs'> extends Readonly<
		Record<string, GraphValue>
	>
		? PipelineWitnessValue<TPipeline, 'inputs'>
		: never;

type PipelineNodesOf<TPipeline> =
	PipelineWitnessValue<TPipeline, 'nodes'> extends NodeRegistry
		? PipelineWitnessValue<TPipeline, 'nodes'>
		: never;

type PipelineEffectsOf<TPipeline> =
	PipelineWitnessValue<TPipeline, 'effects'> extends EffectRegistry
		? PipelineWitnessValue<TPipeline, 'effects'>
		: never;

type PipelineProjectionOf<TPipeline> =
	PipelineWitnessValue<TPipeline, 'outputs'> extends OutputProjection<
		PipelineNodesOf<TPipeline>
	>
		? PipelineWitnessValue<TPipeline, 'outputs'>
		: never;

type RunResultFor<TPipeline> = RunPipelineResult<
	PipelineNodesOf<TPipeline>,
	PipelineEffectsOf<TPipeline>,
	PipelineProjectionOf<TPipeline>
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
 * This function performs no graph work and claims no durable or cross-process
 * authority.
 *
 * @param options - Complete evaluator configuration to capture.
 * @returns A frozen process-local Pipeline token.
 * @public
 */
export const createPipeline = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	const TProjection extends OutputProjection<TNodes>,
	TCapabilities,
	const TParticipants extends Readonly<Record<PropertyKey, unknown>>,
	const TExtensions extends
		readonly GraphExtensionRegistrationShape[] = readonly [],
	const TMiddleware extends
		readonly NodeMiddlewareRegistration[] = readonly [],
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
> => {
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
	) as Pipeline<
		TInputs,
		PipelineNodes<TNodes, TExtensions>,
		PipelineEdges<TEdges, TExtensions>,
		TEffects,
		PipelineProjection<TNodes, TProjection, TExtensions>,
		TCapabilities
	>;
};

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
export const runPipeline = <const TPipeline>(options: {
	readonly pipeline: TPipeline extends PipelineShape ? TPipeline : never;
	readonly inputs: NoInfer<PipelineInputOf<TPipeline>>;
	readonly capabilities: NoInfer<
		PipelineWitnessValue<TPipeline, 'capabilities'>
	>;
	readonly signal?: AbortSignal;
}): RunResultFor<TPipeline> => {
	const captured = captureRunFields(options);
	if (!captured.ok) {
		return captured.failure as RunResultFor<TPipeline>;
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
		}) as RunResultFor<TPipeline>;
	}
	const inputs = ownGraphInputSnapshot({ value: captured.value.inputs });
	if (!inputs.ok) {
		return admissionFailure({
			field: 'inputs',
			error: inputs.error,
		}) as RunResultFor<TPipeline>;
	}
	const signalError = invalidRunSignal(captured.value.signal);
	if (signalError) {
		return admissionFailure({
			field: 'signal',
			error: signalError,
		}) as RunResultFor<TPipeline>;
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
	) as RunResultFor<TPipeline>;
};
