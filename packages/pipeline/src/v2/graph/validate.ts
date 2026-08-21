import { diagnostic } from './diagnostics.js';
import { inspectDenseArray, inspectRecord } from './inspection.js';
import type {
	CandidateNode,
	CollectedGraph,
	ValidatedGraph,
	ValidatedNode,
} from './internal.js';
import { frozenSortedRecord, nullRecord, rawKeyCompare } from './ordering.js';
import type {
	Edge,
	GraphDiagnostic,
	GraphValue,
	NodeContract,
} from './types.js';

const isPositiveSafeInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const uniqueStrings = (options: {
	readonly values: readonly unknown[];
	readonly path: readonly string[];
	readonly code: 'invalid-input' | 'invalid-effect';
	readonly diagnostics: GraphDiagnostic[];
}): readonly string[] => {
	const seen = new Set<string>();
	const valid: string[] = [];
	for (const value of options.values) {
		if (typeof value !== 'string' || seen.has(value)) {
			options.diagnostics.push(
				diagnostic(
					options.code,
					`${options.path.at(-1)} must contain unique string keys.`,
					options.path
				)
			);
			continue;
		}
		seen.add(value);
		valid.push(value);
	}
	return valid.sort(rawKeyCompare);
};

const hasValidContractShape = (options: {
	readonly external: ReturnType<typeof inspectDenseArray>;
	readonly effects: ReturnType<typeof inspectDenseArray>;
	readonly priority: unknown;
}): options is {
	readonly external: {
		readonly ok: true;
		readonly value: readonly unknown[];
	};
	readonly effects: { readonly ok: true; readonly value: readonly unknown[] };
	readonly priority: number;
} =>
	options.external.ok &&
	options.effects.ok &&
	typeof options.priority === 'number' &&
	Number.isFinite(options.priority);

const contractFields = (
	node: CandidateNode,
	diagnostics: GraphDiagnostic[]
): ReadonlyMap<string, unknown> | undefined => {
	try {
		const inspected = inspectRecord(node.contract);
		if (inspected.ok) {
			return new Map(
				inspected.value.map(({ key, value }) => [key, value] as const)
			);
		}
	} catch {
		// The diagnostic below also contains hostile inspection failures.
	}
	diagnostics.push(
		diagnostic(
			'invalid-node',
			`Node "${node.key}" must be an inspectable plain record.`,
			['nodes', node.key]
		)
	);
	return undefined;
};

const appendUnknownReferences = (options: {
	readonly values: readonly string[];
	readonly known: ReadonlySet<string>;
	readonly nodeKey: string;
	readonly kind: 'input' | 'effect';
	readonly diagnostics: GraphDiagnostic[];
}): void => {
	for (const key of options.values) {
		if (!options.known.has(key)) {
			const field =
				options.kind === 'input' ? 'externalInputs' : 'effectKeys';
			options.diagnostics.push(
				diagnostic(
					options.kind === 'input'
						? 'invalid-input'
						: 'invalid-effect',
					`Node "${options.nodeKey}" references unknown ${options.kind} "${key}".`,
					['nodes', options.nodeKey, field]
				)
			);
		}
	}
};

const inspectedContract = (options: {
	readonly node: CandidateNode;
	readonly inputKeys: ReadonlySet<string>;
	readonly effectKeys: ReadonlySet<string>;
	readonly diagnostics: GraphDiagnostic[];
}): ValidatedNode | undefined => {
	const fields = contractFields(options.node, options.diagnostics);
	if (!fields) {
		return undefined;
	}
	const external = inspectDenseArray(fields.get('externalInputs'));
	const effects = inspectDenseArray(fields.get('effectKeys'));
	const priority = fields.get('priority');
	if (!effects.ok) {
		options.diagnostics.push(
			diagnostic(
				'invalid-effect',
				`Node "${options.node.key}" requires a dense effectKeys array.`,
				['nodes', options.node.key, 'effectKeys']
			)
		);
	}
	const shape = { external, effects, priority };
	if (!hasValidContractShape(shape)) {
		if (
			!external.ok ||
			typeof priority !== 'number' ||
			!Number.isFinite(priority)
		) {
			options.diagnostics.push(
				diagnostic(
					'invalid-node',
					`Node "${options.node.key}" requires dense externalInputs and finite priority.`,
					['nodes', options.node.key]
				)
			);
		}
		return undefined;
	}
	const externalInputs = uniqueStrings({
		values: shape.external.value,
		path: ['nodes', options.node.key, 'externalInputs'],
		code: 'invalid-input',
		diagnostics: options.diagnostics,
	});
	const effectKeys = uniqueStrings({
		values: shape.effects.value,
		path: ['nodes', options.node.key, 'effectKeys'],
		code: 'invalid-effect',
		diagnostics: options.diagnostics,
	});
	appendUnknownReferences({
		values: externalInputs,
		known: options.inputKeys,
		nodeKey: options.node.key,
		kind: 'input',
		diagnostics: options.diagnostics,
	});
	appendUnknownReferences({
		values: effectKeys,
		known: options.effectKeys,
		nodeKey: options.node.key,
		kind: 'effect',
		diagnostics: options.diagnostics,
	});
	return {
		key: options.node.key,
		registrationOrder: options.node.registrationOrder,
		contract: {
			externalInputs,
			effectKeys,
			priority: shape.priority,
		} as NodeContract<string, GraphValue, unknown, string>,
	};
};

const validateNodes = (options: {
	readonly candidates: readonly CandidateNode[];
	readonly inputKeys: ReadonlySet<string>;
	readonly effectKeys: ReadonlySet<string>;
	readonly diagnostics: GraphDiagnostic[];
}): ReadonlyMap<string, ValidatedNode> => {
	const nodes = new Map<string, ValidatedNode>();
	const ordered = [...options.candidates].sort(
		(left, right) =>
			left.registrationOrder - right.registrationOrder ||
			rawKeyCompare(left.key, right.key)
	);
	for (const candidate of ordered) {
		if (nodes.has(candidate.key)) {
			options.diagnostics.push(
				diagnostic(
					'duplicate-node',
					`Node key "${candidate.key}" is declared more than once.`,
					['nodes', candidate.key]
				)
			);
			continue;
		}
		const node = inspectedContract({
			node: candidate,
			inputKeys: options.inputKeys,
			effectKeys: options.effectKeys,
			diagnostics: options.diagnostics,
		});
		if (node) {
			nodes.set(node.key, node);
		}
	}
	return nodes;
};

const inspectedEdge = (value: unknown): Edge | undefined => {
	const inspected = inspectRecord(value);
	if (!inspected.ok) {
		return undefined;
	}
	const fields = new Map(
		inspected.value.map(({ key, value: field }) => [key, field] as const)
	);
	const from = fields.get('from');
	const to = fields.get('to');
	return typeof from === 'string' && typeof to === 'string'
		? { from, to }
		: undefined;
};

const validateEdges = (options: {
	readonly values: readonly unknown[];
	readonly nodes: ReadonlyMap<string, ValidatedNode>;
	readonly diagnostics: GraphDiagnostic[];
}): readonly Edge[] => {
	const pairs = new Map<string, Set<string>>();
	const edges: Edge[] = [];
	for (const [index, value] of options.values.entries()) {
		let edge: Edge | undefined;
		try {
			edge = inspectedEdge(value);
		} catch {
			edge = undefined;
		}
		if (!edge) {
			options.diagnostics.push(
				diagnostic(
					'invalid-node',
					'Edges require string from and to keys.',
					['edges', String(index)]
				)
			);
			continue;
		}
		if (!options.nodes.has(edge.from) || !options.nodes.has(edge.to)) {
			options.diagnostics.push(
				diagnostic(
					'missing-node',
					`Edge "${edge.from}" to "${edge.to}" references an unknown node.`,
					['edges', String(index)]
				)
			);
			continue;
		}
		const targets = pairs.get(edge.from) ?? new Set<string>();
		if (targets.has(edge.to)) {
			options.diagnostics.push(
				diagnostic(
					'invalid-node',
					`Edge "${edge.from}" to "${edge.to}" is duplicated.`,
					['edges', String(index)]
				)
			);
			continue;
		}
		targets.add(edge.to);
		pairs.set(edge.from, targets);
		edges.push(edge);
	}
	return edges;
};

const validateReferences = (options: {
	readonly values: Readonly<Record<string, unknown>>;
	readonly nodes: ReadonlyMap<string, ValidatedNode>;
	readonly kind: 'outputs' | 'anchors';
	readonly code: 'invalid-output' | 'invalid-anchor';
	readonly diagnostics: GraphDiagnostic[];
}): Readonly<Record<string, string>> => {
	const valid: [string, string][] = [];
	for (const [key, nodeKey] of Object.entries(options.values)) {
		if (typeof nodeKey !== 'string' || !options.nodes.has(nodeKey)) {
			options.diagnostics.push(
				diagnostic(
					options.code,
					`${options.kind.slice(0, -1)} "${key}" references unknown node "${String(nodeKey)}".`,
					[options.kind, key]
				)
			);
			continue;
		}
		valid.push([key, nodeKey]);
	}
	return frozenSortedRecord(valid);
};

const validateExecutors = (options: {
	readonly values: Readonly<Record<string, unknown>>;
	readonly nodes: ReadonlyMap<string, ValidatedNode>;
	readonly diagnostics: GraphDiagnostic[];
}): Readonly<Record<string, unknown>> => {
	const retained = nullRecord<unknown>();
	for (const key of new Set([
		...options.nodes.keys(),
		...Object.keys(options.values),
	])) {
		const executor = options.values[key];
		if (!options.nodes.has(key) || typeof executor !== 'function') {
			options.diagnostics.push(
				diagnostic(
					'invalid-node',
					`Executor "${key}" must exactly cover one valid node with a function.`,
					['executors', key]
				)
			);
			continue;
		}
		retained[key] = executor;
	}
	return Object.freeze(retained);
};

const validatePolicy = (
	value: unknown,
	diagnostics: GraphDiagnostic[]
): { readonly maxConcurrency: number | 'unbounded' } => {
	let maxConcurrency: unknown;
	try {
		const inspected = inspectRecord(value);
		if (!inspected.ok) {
			throw new Error(inspected.reason);
		}
		maxConcurrency = inspected.value.find(
			({ key }) => key === 'maxConcurrency'
		)?.value;
	} catch {
		diagnostics.push(
			diagnostic(
				'invalid-node',
				'Execution policy must be inspectable immutable data.',
				['policy']
			)
		);
		return { maxConcurrency: 'unbounded' };
	}
	if (
		maxConcurrency !== 'unbounded' &&
		!isPositiveSafeInteger(maxConcurrency)
	) {
		diagnostics.push(
			diagnostic(
				'invalid-policy',
				'Execution policy maxConcurrency must be a positive safe integer or "unbounded".',
				['policy', 'maxConcurrency']
			)
		);
		return { maxConcurrency: 'unbounded' };
	}
	return { maxConcurrency };
};

export const validateGraph = (
	collected: CollectedGraph,
	diagnostics: GraphDiagnostic[]
): ValidatedGraph => {
	const inputKeys = uniqueStrings({
		values: collected.inputKeys,
		path: ['inputKeys'],
		code: 'invalid-input',
		diagnostics,
	});
	const effectKeys = new Set(collected.effectKeys);
	const nodes = validateNodes({
		candidates: collected.nodes,
		inputKeys: new Set(inputKeys),
		effectKeys,
		diagnostics,
	});
	const edges = validateEdges({
		values: collected.edges,
		nodes,
		diagnostics,
	});
	return {
		nodes,
		edges,
		inputKeys,
		outputs: validateReferences({
			values: collected.outputs,
			nodes,
			kind: 'outputs',
			code: 'invalid-output',
			diagnostics,
		}),
		anchors: validateReferences({
			values: collected.anchors,
			nodes,
			kind: 'anchors',
			code: 'invalid-anchor',
			diagnostics,
		}),
		policy: validatePolicy(collected.policy, diagnostics),
		executors: validateExecutors({
			values: collected.executors,
			nodes,
			diagnostics,
		}),
		diagnostics,
	};
};
