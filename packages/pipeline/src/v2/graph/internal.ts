import type {
	Edge,
	GraphDiagnostic,
	GraphValue,
	NodeContract,
} from './types.js';

export interface CandidateNode {
	readonly key: string;
	readonly contract: unknown;
	readonly registrationOrder: number;
}

export interface ValidatedNode {
	readonly key: string;
	readonly contract: NodeContract<string, GraphValue, unknown, string>;
	readonly registrationOrder: number;
}

export interface CollectedGraph {
	readonly nodes: readonly CandidateNode[];
	readonly edges: readonly unknown[];
	readonly anchors: Readonly<Record<string, unknown>>;
	readonly outputs: Readonly<Record<string, unknown>>;
	readonly inputKeys: readonly unknown[];
	readonly effectKeys: readonly string[];
	readonly policy: unknown;
	readonly executors: Readonly<Record<string, unknown>>;
}

export interface ValidatedGraph {
	readonly nodes: ReadonlyMap<string, ValidatedNode>;
	readonly edges: readonly Edge[];
	readonly anchors: Readonly<Record<string, string>>;
	readonly outputs: Readonly<Record<string, string>>;
	readonly inputKeys: readonly string[];
	readonly policy: { readonly maxConcurrency: number | 'unbounded' };
	readonly executors: Readonly<Record<string, unknown>>;
	readonly diagnostics: readonly GraphDiagnostic[];
}
