import { diagnostic } from './diagnostics.js';
import { inspectDenseArray, inspectRecord } from './inspection.js';
import type { CandidateNode, CollectedGraph } from './internal.js';
import { nullRecord, rawKeyCompare } from './ordering.js';
import type { GraphDiagnostic, GraphDiagnosticCode } from './types.js';

interface InspectedContribution {
	readonly order: number;
	readonly index: number;
	readonly fields: ReadonlyMap<string, unknown>;
}

const inspectRecordAt = (options: {
	readonly value: unknown;
	readonly diagnostics: GraphDiagnostic[];
	readonly path: readonly string[];
	readonly code?: GraphDiagnosticCode;
}): readonly (readonly [string, unknown])[] => {
	try {
		const result = inspectRecord(options.value);
		if (result.ok) {
			return result.value.map(({ key, value }) => [key, value] as const);
		}
		options.diagnostics.push(
			diagnostic(
				options.code ?? 'invalid-node',
				`Graph record is invalid: ${result.reason}`,
				options.path
			)
		);
	} catch {
		options.diagnostics.push(
			diagnostic(
				options.code ?? 'invalid-node',
				'Graph record inspection failed.',
				options.path
			)
		);
	}
	return [];
};

const inspectArrayAt = (options: {
	readonly value: unknown;
	readonly diagnostics: GraphDiagnostic[];
	readonly path: readonly string[];
	readonly code?: GraphDiagnosticCode;
}): readonly unknown[] => {
	try {
		const result = inspectDenseArray(options.value);
		if (result.ok) {
			return result.value;
		}
		options.diagnostics.push(
			diagnostic(
				options.code ?? 'invalid-node',
				`Graph array is invalid: ${result.reason}`,
				options.path
			)
		);
	} catch {
		options.diagnostics.push(
			diagnostic(
				options.code ?? 'invalid-node',
				'Graph array inspection failed.',
				options.path
			)
		);
	}
	return [];
};

const fieldMap = (
	entries: readonly (readonly [string, unknown])[]
): ReadonlyMap<string, unknown> => new Map(entries);

const entriesRecord = (
	entries: readonly (readonly [string, unknown])[]
): Readonly<Record<string, unknown>> => {
	const record = nullRecord<unknown>();
	for (const [key, value] of entries) {
		record[key] = value;
	}
	return record;
};

const addNodes = (options: {
	readonly target: CandidateNode[];
	readonly value: unknown;
	readonly order: number;
	readonly diagnostics: GraphDiagnostic[];
	readonly path: readonly string[];
	readonly code?: GraphDiagnosticCode;
}): readonly string[] => {
	const entries = inspectRecordAt({
		value: options.value,
		diagnostics: options.diagnostics,
		path: options.path,
		code: options.code,
	});
	for (const [key, contract] of entries) {
		options.target.push({
			key,
			contract,
			registrationOrder: options.order,
		});
	}
	return entries.map(([key]) => key);
};

const mergeRecord = (
	target: Record<string, unknown>,
	entries: readonly (readonly [string, unknown])[]
): void => {
	for (const [key, value] of entries) {
		target[key] = value;
	}
};

const isContributionOrder = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const inspectContributions = (options: {
	readonly value: unknown;
	readonly diagnostics: GraphDiagnostic[];
}): readonly InspectedContribution[] => {
	const values = inspectArrayAt({
		value: options.value,
		diagnostics: options.diagnostics,
		path: ['contributions'],
		code: 'invalid-contribution',
	});
	const inspected: InspectedContribution[] = [];
	const orders = new Set<number>();
	for (const [index, value] of values.entries()) {
		const entries = inspectRecordAt({
			value,
			diagnostics: options.diagnostics,
			path: ['contributions', String(index)],
			code: 'invalid-contribution',
		});
		const fields = fieldMap(entries);
		if (fields.has('contributions')) {
			options.diagnostics.push(
				diagnostic(
					'reentrant-contribution',
					'Graph contributions cannot contain nested contributions.',
					['contributions', String(index), 'contributions']
				)
			);
		}
		const order = fields.get('registrationOrder');
		if (!isContributionOrder(order) || orders.has(order)) {
			options.diagnostics.push(
				diagnostic(
					'invalid-contribution',
					'Contribution registration orders must be unique positive safe integers.',
					['contributions', String(index), 'registrationOrder']
				)
			);
			continue;
		}
		orders.add(order);
		inspected.push({ order, index, fields });
	}
	return inspected.sort((left, right) => left.order - right.order);
};

const applyContribution = (options: {
	readonly contribution: InspectedContribution;
	readonly nodes: CandidateNode[];
	readonly edges: unknown[];
	readonly outputs: Record<string, unknown>;
	readonly anchors: Record<string, unknown>;
	readonly executors: Record<string, unknown>;
	readonly diagnostics: GraphDiagnostic[];
}): void => {
	const { contribution } = options;
	const path = ['contributions', String(contribution.index)];
	const nodeKeys = addNodes({
		target: options.nodes,
		value: contribution.fields.get('nodes') ?? nullRecord<unknown>(),
		order: contribution.order,
		diagnostics: options.diagnostics,
		path: [...path, 'nodes'],
		code: 'invalid-contribution',
	});
	const executorEntries = inspectRecordAt({
		value: contribution.fields.get('executors'),
		diagnostics: options.diagnostics,
		path: [...path, 'executors'],
		code: 'invalid-contribution',
	});
	const sortedNodeKeys = nodeKeys.slice().sort(rawKeyCompare);
	const executorKeys = executorEntries
		.map(([key]) => key)
		.sort(rawKeyCompare);
	if (
		sortedNodeKeys.length !== executorKeys.length ||
		sortedNodeKeys.some((key, index) => key !== executorKeys[index])
	) {
		options.diagnostics.push(
			diagnostic(
				'invalid-contribution',
				'Contribution executors must exactly cover its contributed nodes.',
				[...path, 'executors']
			)
		);
	}
	mergeRecord(options.executors, executorEntries);
	options.edges.push(
		...inspectArrayAt({
			value: contribution.fields.get('edges') ?? [],
			diagnostics: options.diagnostics,
			path: [...path, 'edges'],
			code: 'invalid-contribution',
		})
	);
	mergeRecord(
		options.outputs,
		inspectRecordAt({
			value: contribution.fields.get('outputs') ?? nullRecord<unknown>(),
			diagnostics: options.diagnostics,
			path: [...path, 'outputs'],
			code: 'invalid-contribution',
		})
	);
	mergeRecord(
		options.anchors,
		inspectRecordAt({
			value: contribution.fields.get('anchors') ?? nullRecord<unknown>(),
			diagnostics: options.diagnostics,
			path: [...path, 'anchors'],
			code: 'invalid-contribution',
		})
	);
};

export const collectGraph = (options: {
	readonly declaration: unknown;
	readonly contributions?: unknown;
	readonly diagnostics: GraphDiagnostic[];
}): CollectedGraph => {
	const declaration = fieldMap(
		inspectRecordAt({
			value: options.declaration,
			diagnostics: options.diagnostics,
			path: ['declaration'],
		})
	);
	const nodes: CandidateNode[] = [];
	addNodes({
		target: nodes,
		value: declaration.get('nodes'),
		order: 0,
		diagnostics: options.diagnostics,
		path: ['nodes'],
	});
	const edges = [
		...inspectArrayAt({
			value: declaration.get('edges'),
			diagnostics: options.diagnostics,
			path: ['edges'],
		}),
	];
	const outputs = entriesRecord(
		inspectRecordAt({
			value: declaration.get('outputs'),
			diagnostics: options.diagnostics,
			path: ['outputs'],
		})
	) as Record<string, unknown>;
	const anchors = entriesRecord(
		inspectRecordAt({
			value: declaration.get('anchors') ?? nullRecord<unknown>(),
			diagnostics: options.diagnostics,
			path: ['anchors'],
		})
	) as Record<string, unknown>;
	const executors = entriesRecord(
		inspectRecordAt({
			value: declaration.get('executors'),
			diagnostics: options.diagnostics,
			path: ['executors'],
		})
	) as Record<string, unknown>;
	if (options.contributions !== undefined) {
		for (const contribution of inspectContributions({
			value: options.contributions,
			diagnostics: options.diagnostics,
		})) {
			applyContribution({
				contribution,
				nodes,
				edges,
				outputs,
				anchors,
				executors,
				diagnostics: options.diagnostics,
			});
		}
	}
	return {
		nodes,
		edges,
		outputs,
		anchors,
		executors,
		inputKeys: inspectArrayAt({
			value: declaration.get('inputKeys'),
			diagnostics: options.diagnostics,
			path: ['inputKeys'],
		}),
		effectKeys: inspectRecordAt({
			value: declaration.get('effects'),
			diagnostics: options.diagnostics,
			path: ['effects'],
		}).map(([key]) => key),
		policy: declaration.get('policy'),
	};
};
