import { inspectDenseArray, inspectRecord } from '../graph/inspection.js';
import { sortedKeys } from '../graph/ordering.js';
import type { NodeMiddlewareRegistration } from '../middleware/types.js';
import type { RunObserver } from '../observers/types.js';
import { createGraphSchedulerError } from '../scheduler/errors.js';
import type { PipelineConfigurationIssue } from './types.js';

type RoleFailure = Extract<
	PipelineConfigurationIssue,
	{ readonly kind: 'role' }
>;

export interface OwnedPipelineMiddleware {
	readonly index: number;
	readonly registration: NodeMiddlewareRegistration;
}

interface OwnedPipelineRoles {
	readonly middleware: readonly OwnedPipelineMiddleware[];
	readonly observers: readonly RunObserver[];
	readonly participants: Readonly<Record<string, unknown>>;
	readonly failures: readonly RoleFailure[];
}

const roleFailure = (options: {
	readonly role: RoleFailure['role'];
	readonly message: string;
	readonly code:
		| 'invalid-middleware'
		| 'invalid-observer'
		| 'invalid-participant';
	readonly index?: number;
	readonly key?: string;
	readonly cause?: unknown;
}): RoleFailure =>
	Object.freeze({
		kind: 'role',
		role: options.role,
		...(options.index === undefined ? {} : { index: options.index }),
		...(options.key === undefined ? {} : { key: options.key }),
		error: createGraphSchedulerError({
			code: options.code,
			message: options.message,
			...(options.cause === undefined ? {} : { cause: options.cause }),
		}),
	});

const recordFields = (value: unknown): ReadonlyMap<string, unknown> => {
	const inspected = inspectRecord(value);
	if (!inspected.ok) {
		throw new TypeError(inspected.reason);
	}
	return new Map(
		inspected.value.map(({ key, value: field }) => [key, field] as const)
	);
};

const optionalCallbacks = (
	fields: ReadonlyMap<string, unknown>,
	owner: string,
	phases: readonly string[]
): Readonly<Record<string, unknown>> => {
	const callbacks: Record<string, unknown> = {};
	for (const phase of phases) {
		if (!fields.has(phase)) {
			continue;
		}
		const callback = fields.get(phase);
		if (typeof callback !== 'function') {
			throw new TypeError(`${owner} ${phase} phase must be callable.`);
		}
		callbacks[phase] = callback;
	}
	return callbacks;
};

const requiredCallbacks = (
	fields: ReadonlyMap<string, unknown>,
	owner: string,
	phases: readonly string[]
): Readonly<Record<string, unknown>> => {
	const callbacks: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	for (const phase of phases) {
		const callback = fields.get(phase);
		if (typeof callback !== 'function') {
			throw new TypeError(`${owner} ${phase} must be callable.`);
		}
		callbacks[phase] = callback;
	}
	return callbacks;
};

const ownMiddleware = (options: {
	readonly value: unknown;
	readonly failures: RoleFailure[];
}): readonly OwnedPipelineMiddleware[] => {
	let values: readonly unknown[];
	try {
		const inspected = inspectDenseArray(options.value ?? []);
		if (!inspected.ok) {
			throw new TypeError(inspected.reason);
		}
		values = inspected.value;
	} catch (cause) {
		options.failures.push(
			roleFailure({
				role: 'middleware',
				code: 'invalid-middleware',
				message:
					'Node middleware must be a dense array of plain records.',
				cause,
			})
		);
		return Object.freeze([]);
	}
	const owned: OwnedPipelineMiddleware[] = [];
	for (const [index, value] of values.entries()) {
		try {
			const fields = recordFields(value);
			const node = fields.get('node');
			if (typeof node !== 'string') {
				throw new TypeError('Middleware must name one node key.');
			}
			const middleware = {
				node,
				...optionalCallbacks(fields, 'Middleware', [
					'before',
					'after',
					'error',
					'cancel',
				]),
			};
			owned.push(
				Object.freeze({
					index,
					registration: Object.freeze(
						middleware
					) as unknown as NodeMiddlewareRegistration,
				})
			);
		} catch (cause) {
			options.failures.push(
				roleFailure({
					role: 'middleware',
					code: 'invalid-middleware',
					index,
					message: `Middleware registration ${index} is invalid.`,
					cause,
				})
			);
		}
	}
	return Object.freeze(owned);
};

const ownObservers = (options: {
	readonly value: unknown;
	readonly failures: RoleFailure[];
}): readonly RunObserver[] => {
	let values: readonly unknown[];
	try {
		const inspected = inspectDenseArray(options.value ?? []);
		if (!inspected.ok) {
			throw new TypeError(inspected.reason);
		}
		values = inspected.value;
	} catch (cause) {
		options.failures.push(
			roleFailure({
				role: 'observer',
				code: 'invalid-observer',
				message: 'Run observers must be a dense array of functions.',
				cause,
			})
		);
		return Object.freeze([]);
	}
	const observers: RunObserver[] = [];
	for (const [index, observer] of values.entries()) {
		if (typeof observer === 'function') {
			observers.push(observer as RunObserver);
			continue;
		}
		options.failures.push(
			roleFailure({
				role: 'observer',
				code: 'invalid-observer',
				index,
				message: `Run observer ${index} must be callable.`,
			})
		);
	}
	return Object.freeze(observers);
};

const ownParticipants = (options: {
	readonly value: unknown;
	readonly failures: RoleFailure[];
}): Readonly<Record<string, unknown>> => {
	let entries: readonly (readonly [string, unknown])[];
	try {
		entries = [...recordFields(options.value)].map(([key, value]) => [
			key,
			value,
		]);
	} catch (cause) {
		options.failures.push(
			roleFailure({
				role: 'participant',
				code: 'invalid-participant',
				message:
					'Effect participants must be an inspectable plain record.',
				cause,
			})
		);
		return Object.freeze(Object.create(null) as Record<string, unknown>);
	}
	const participants: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	for (const [key, value] of entries) {
		try {
			const fields = recordFields(value);
			const participant = requiredCallbacks(
				fields,
				'Effect participant',
				['prepare', 'commit', 'compensate']
			);
			participants[key] = Object.freeze(participant);
		} catch (cause) {
			options.failures.push(
				roleFailure({
					role: 'participant',
					code: 'invalid-participant',
					key,
					message: `Effect participant "${key}" is invalid.`,
					cause,
				})
			);
		}
	}
	return Object.freeze(participants);
};

/**
 * Owns every function-bearing role without creating run-local state.
 *
 * @param options              - Role values to inspect and own.
 * @param options.middleware   - Exact-node middleware tuple candidate.
 * @param options.observers    - Observer tuple candidate.
 * @param options.participants - Effect participant record candidate.
 */
export const ownPipelineRoles = (options: {
	readonly middleware?: unknown;
	readonly observers?: unknown;
	readonly participants: unknown;
}): OwnedPipelineRoles => {
	const failures: RoleFailure[] = [];
	const middleware = ownMiddleware({
		value: options.middleware,
		failures,
	});
	const observers = ownObservers({ value: options.observers, failures });
	const participants = ownParticipants({
		value: options.participants,
		failures,
	});
	return Object.freeze({
		middleware,
		observers,
		participants,
		failures: Object.freeze(failures),
	});
};

/**
 * Collects every graph-dependent role issue without compiling executable roles.
 *
 * @param options              - Owned roles and compiled graph identities.
 * @param options.nodeKeys     - Every node key retained by graph compilation.
 * @param options.effectKeys   - Every effect key declared by the base graph.
 * @param options.middleware   - Owned middleware registrations to validate.
 * @param options.participants - Owned effect participants to validate.
 */
export const collectPipelineRoleFailures = (options: {
	readonly nodeKeys: readonly string[];
	readonly effectKeys: readonly string[];
	readonly middleware: readonly OwnedPipelineMiddleware[];
	readonly participants: Readonly<Record<string, unknown>>;
}): readonly RoleFailure[] => {
	const failures: RoleFailure[] = [];
	const nodeKeys = new Set(options.nodeKeys);
	for (const middleware of options.middleware) {
		if (!nodeKeys.has(middleware.registration.node)) {
			failures.push(
				roleFailure({
					role: 'middleware',
					code: 'invalid-middleware',
					index: middleware.index,
					message: `Middleware registration ${middleware.index} must name one compiled node.`,
				})
			);
		}
	}
	const declared = new Set(options.effectKeys);
	const participantKeys = sortedKeys(Object.keys(options.participants));
	for (const key of participantKeys) {
		if (!declared.has(key)) {
			failures.push(
				roleFailure({
					role: 'participant',
					code: 'invalid-participant',
					key,
					message: `Effect participant "${key}" is not declared by the graph.`,
				})
			);
		}
	}
	const participants = new Set(participantKeys);
	for (const key of options.effectKeys) {
		if (!participants.has(key)) {
			failures.push(
				roleFailure({
					role: 'participant',
					code: 'invalid-participant',
					key,
					message: `Effect participant "${key}" is required by the graph.`,
				})
			);
		}
	}
	return Object.freeze(failures);
};
