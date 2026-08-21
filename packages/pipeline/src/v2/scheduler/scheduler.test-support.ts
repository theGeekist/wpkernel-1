import { compileGraphOrThrow } from '../graph/compile.js';
import type {
	Edge,
	EffectRegistry,
	ErasedGraph,
	ErasedGraphDeclaration,
	GraphValue,
} from '../graph/types.js';
import { scheduleGraph } from './schedule.js';
import type { ErasedScheduleOutcome } from './state.js';

export interface TestInvocation {
	readonly input: {
		readonly external: Readonly<Record<string, GraphValue>>;
		readonly dependencies: Readonly<Record<string, GraphValue>>;
	};
	readonly capabilities: unknown;
	readonly signal: AbortSignal;
}

export type TestExecutor = (invocation: TestInvocation) => unknown;

export interface TestNode {
	readonly key: string;
	readonly executor: TestExecutor;
	readonly externalInputs?: readonly string[];
	readonly effectKeys?: readonly string[];
	readonly priority?: number;
}

const materialiseNodes = (
	definitions: readonly TestNode[]
): {
	readonly nodes: Readonly<Record<string, unknown>>;
	readonly executors: Readonly<Record<string, TestExecutor>>;
} => {
	const nodes: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	const executors: Record<string, TestExecutor> = Object.create(
		null
	) as Record<string, TestExecutor>;
	for (const node of definitions) {
		nodes[node.key] = {
			externalInputs: node.externalInputs ?? [],
			effectKeys: node.effectKeys ?? [],
			priority: node.priority ?? 0,
		};
		executors[node.key] = node.executor;
	}
	return { nodes, executors };
};

const materialiseEffects = (
	keys: readonly string[]
): Readonly<Record<string, unknown>> => {
	const effects: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	for (const key of keys) {
		effects[key] = {};
	}
	return effects;
};

export const compileTestGraph = (options: {
	readonly nodes: readonly TestNode[];
	readonly edges?: readonly Edge[];
	readonly inputKeys?: readonly string[];
	readonly effectKeys?: readonly string[];
	readonly outputs?: Readonly<Record<string, string>>;
	readonly maxConcurrency?: number | 'unbounded';
}): ErasedGraph => {
	const { nodes, executors } = materialiseNodes(options.nodes);
	const declaration = {
		inputKeys: options.inputKeys ?? [],
		nodes,
		edges: options.edges ?? [],
		effects: materialiseEffects(options.effectKeys ?? []),
		outputs: options.outputs ?? {},
		policy: { maxConcurrency: options.maxConcurrency ?? 'unbounded' },
		executors,
	} as unknown as ErasedGraphDeclaration;
	return compileGraphOrThrow({ declaration });
};

export const runTestGraph = (options: {
	readonly graph: ErasedGraph;
	readonly inputs?: Readonly<Record<string, GraphValue>>;
	readonly capabilities?: unknown;
	readonly signal?: AbortSignal;
}):
	| ErasedScheduleOutcome<EffectRegistry>
	| Promise<ErasedScheduleOutcome<EffectRegistry>> =>
	scheduleGraph({
		graph: options.graph,
		inputs: options.inputs ?? {},
		capabilities: options.capabilities,
		...(options.signal ? { signal: options.signal } : {}),
	}) as
		| ErasedScheduleOutcome<EffectRegistry>
		| Promise<ErasedScheduleOutcome<EffectRegistry>>;

export interface Controlled<T> {
	readonly promise: Promise<T>;
	readonly resolve: (value: T) => void;
	readonly reject: (error: unknown) => void;
}

export const controlled = <T>(): Controlled<T> => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
};

export const success = <T extends GraphValue>(output: T) => ({
	kind: 'success' as const,
	output,
	effects: [],
});

export const failure = (error: unknown) => ({
	kind: 'failure' as const,
	error,
});

export const flushMicrotasks = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};
