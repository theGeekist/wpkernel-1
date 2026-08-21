import type { RunEvent } from '../observers/types.js';

/** Canonical diagnostic record for one node at a segment boundary. */
export interface NodeDiagnostic {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly state: 'pending' | 'succeeded' | 'failed' | 'cancelled';
	readonly readiness?: 'ready' | 'blocked';
	readonly blockedBy?: readonly string[];
	readonly admissionSequence?: number;
	readonly settlementSequence?: number;
}

/** Immutable canonical records plus honest timing-dependent FIFO chronology. */
export interface RunDiagnostics {
	readonly nodes: readonly NodeDiagnostic[];
	readonly events: readonly RunEvent[];
}
