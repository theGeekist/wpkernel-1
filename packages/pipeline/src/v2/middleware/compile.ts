import { inspectRecord } from '../graph/inspection.js';
import type { ErasedGraph } from '../graph/types.js';
import { createGraphSchedulerError } from '../scheduler/errors.js';
import type {
	CompiledNodeMiddleware,
	ErasedNodeMiddleware,
	NodeMiddlewareRegistration,
} from './types.js';

const phaseNames = ['before', 'after', 'error', 'cancel'] as const;

const inspectMiddleware = (options: {
	readonly value: unknown;
	readonly registrationOrder: number;
	readonly graph: ErasedGraph;
}): ErasedNodeMiddleware => {
	let fields: ReadonlyMap<string, unknown>;
	try {
		const inspected = inspectRecord(options.value);
		if (!inspected.ok) {
			throw new Error(inspected.reason);
		}
		fields = new Map(
			inspected.value.map(({ key, value }) => [key, value] as const)
		);
	} catch (cause) {
		throw createGraphSchedulerError({
			code: 'invalid-middleware',
			message: `Middleware registration ${options.registrationOrder} must be an inspectable plain record.`,
			cause,
		});
	}
	const node = fields.get('node');
	if (typeof node !== 'string' || !options.graph.nodes[node]) {
		throw createGraphSchedulerError({
			code: 'invalid-middleware',
			message: `Middleware registration ${options.registrationOrder} must name one compiled node.`,
		});
	}
	for (const phase of phaseNames) {
		if (fields.has(phase) && typeof fields.get(phase) !== 'function') {
			throw createGraphSchedulerError({
				code: 'invalid-middleware',
				message: `Middleware for node "${node}" has a non-callable ${phase} phase.`,
			});
		}
	}
	return Object.freeze({
		node,
		registrationOrder: options.registrationOrder,
		...Object.fromEntries(
			phaseNames.flatMap((phase) =>
				fields.has(phase) ? [[phase, fields.get(phase)]] : []
			)
		),
	}) as ErasedNodeMiddleware;
};

/**
 * Captures static single-node middleware eligibility in registration order.
 *
 * @param options            - Middleware compilation options.
 * @param options.graph      - Compiled graph used for static node eligibility.
 * @param options.middleware - Immutable middleware registration snapshot.
 */
export const compileNodeMiddleware = (options: {
	readonly graph: ErasedGraph;
	readonly middleware?: readonly NodeMiddlewareRegistration[];
}): CompiledNodeMiddleware => {
	const byNode = new Map<string, ErasedNodeMiddleware[]>();
	for (const [registrationOrder, value] of (
		options.middleware ?? []
	).entries()) {
		const middleware = inspectMiddleware({
			value,
			registrationOrder,
			graph: options.graph,
		});
		const registered = byNode.get(middleware.node) ?? [];
		registered.push(middleware);
		byNode.set(middleware.node, registered);
	}
	return new Map(
		[...byNode].map(([node, registered]) => [
			node,
			Object.freeze([...registered]),
		])
	);
};
