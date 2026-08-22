import { inspectRecord } from '../graph/inspection.js';
import type {
	ErasedGraphDeclaration,
	RegisteredGraphContribution,
} from '../graph/types.js';
import { copyGraphValue } from '../graph/values.js';

const graphField = (value: unknown): unknown => {
	const copied = copyGraphValue({ value });
	return copied.ok ? copied.value : null;
};

const executorField = (value: unknown): unknown => {
	try {
		const inspected = inspectRecord(value);
		if (!inspected.ok) {
			return null;
		}
		const executors: Record<string, unknown> = Object.create(
			null
		) as Record<string, unknown>;
		for (const { key, value: executor } of inspected.value) {
			executors[key] = executor;
		}
		return Object.freeze(executors);
	} catch {
		return null;
	}
};

const declarationFields = [
	'inputKeys',
	'nodes',
	'edges',
	'effects',
	'outputs',
	'policy',
	'anchors',
] as const;

/**
 * Captures the complete base declaration before extension callbacks drain.
 *
 * @param value - Untrusted base declaration candidate.
 */
export const ownGraphExtensionDeclaration = (
	value: unknown
): ErasedGraphDeclaration => {
	let fields: ReadonlyMap<string, unknown> = new Map();
	try {
		const inspected = inspectRecord(value);
		if (inspected.ok) {
			fields = new Map(
				inspected.value.map(
					({ key, value: field }) => [key, field] as const
				)
			);
		}
	} catch {
		// The frozen invalid candidate is diagnosed by the graph compiler.
	}
	return Object.freeze({
		...Object.fromEntries(
			declarationFields.flatMap((field) =>
				fields.has(field)
					? [[field, graphField(fields.get(field))]]
					: []
			)
		),
		executors: executorField(fields.get('executors')),
	}) as ErasedGraphDeclaration;
};

/**
 * Captures a callback result immediately when that callback settles.
 *
 * @param options                   - Settled contribution ownership options.
 * @param options.value             - The untrusted callback result.
 * @param options.registrationOrder - Stable extension registration order.
 */
export const ownGraphContribution = (options: {
	readonly value: unknown;
	readonly registrationOrder: number;
}): RegisteredGraphContribution => {
	let fields: ReadonlyMap<string, unknown> = new Map();
	try {
		const inspected = inspectRecord(options.value);
		if (inspected.ok) {
			fields = new Map(
				inspected.value.map(({ key, value }) => [key, value] as const)
			);
		}
	} catch {
		// The frozen invalid candidate is diagnosed by the graph compiler.
	}
	return Object.freeze({
		registrationOrder: options.registrationOrder,
		...(fields.has('nodes')
			? { nodes: graphField(fields.get('nodes')) }
			: {}),
		...(fields.has('edges')
			? { edges: graphField(fields.get('edges')) }
			: {}),
		...(fields.has('anchors')
			? { anchors: graphField(fields.get('anchors')) }
			: {}),
		...(fields.has('outputs')
			? { outputs: graphField(fields.get('outputs')) }
			: {}),
		executors: executorField(fields.get('executors')),
		...(fields.has('contributions') ? { contributions: [] } : {}),
	}) as RegisteredGraphContribution;
};
