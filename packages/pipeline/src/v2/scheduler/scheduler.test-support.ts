import { compileGraphOrThrow } from '../graph/compile.js';
import type {
	Edge,
	EffectRegistry,
	ErasedGraph,
	ErasedGraphDeclaration,
	GraphValue,
} from '../graph/types.js';
import { scheduleGraph } from './schedule.js';
import type { ErasedRunOutcome } from './state.js';
import type { NodeMiddlewareRegistration } from '../middleware/types.js';
import type { RunObserver } from '../observers/types.js';

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

const defaultParticipants = (
	graph: ErasedGraph
): Readonly<Record<string, unknown>> => {
	const participants: Record<string, unknown> = Object.create(null) as Record<
		string,
		unknown
	>;
	for (const key of new Set(
		Object.values(graph.nodes).flatMap((node) => node.effectKeys)
	)) {
		participants[key] = Object.freeze({
			prepare: ({ payload }: { readonly payload: GraphValue }) => ({
				kind: 'success' as const,
				value: payload,
			}),
			commit: ({ prepared }: { readonly prepared: unknown }) => ({
				kind: 'success' as const,
				value: prepared,
			}),
			compensate: () => ({
				kind: 'success' as const,
				value: undefined,
			}),
		});
	}
	return participants;
};

export const runTestGraph = (options: {
	readonly graph: ErasedGraph;
	readonly inputs?: Readonly<Record<string, GraphValue>>;
	readonly capabilities?: unknown;
	readonly signal?: AbortSignal;
	readonly middleware?: readonly NodeMiddlewareRegistration[];
	readonly observers?: readonly RunObserver[];
	readonly participants?: Readonly<Record<string, unknown>>;
}):
	| ErasedRunOutcome<EffectRegistry>
	| Promise<ErasedRunOutcome<EffectRegistry>> =>
	scheduleGraph({
		graph: options.graph,
		inputs: options.inputs ?? {},
		capabilities: options.capabilities,
		participants: (options.participants ??
			defaultParticipants(options.graph)) as never,
		...(options.signal ? { signal: options.signal } : {}),
		...(options.middleware
			? { middleware: options.middleware as never }
			: {}),
		...(options.observers ? { observers: options.observers } : {}),
	}) as
		| ErasedRunOutcome<EffectRegistry>
		| Promise<ErasedRunOutcome<EffectRegistry>>;

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
