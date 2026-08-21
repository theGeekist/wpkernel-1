import type { RunEvent } from '../observers/types.js';

/**
 * Canonical diagnostic record for one node at a segment boundary.
 * The record is inspection data and carries no scheduler authority.
 *
 * @public
 */
export interface NodeDiagnostic {
	readonly node: string;
	readonly nodeOrdinal: number;
	readonly state: 'pending' | 'succeeded' | 'failed' | 'cancelled';
	readonly readiness?: 'ready' | 'blocked';
	readonly blockedBy?: readonly string[];
	readonly admissionSequence?: number;
	readonly settlementSequence?: number;
}

/**
 * Immutable canonical node records plus honest timing-dependent FIFO events.
 * Canonical records are deterministic; chronology is evidence of this run and
 * is not used to choose graph meaning or failure precedence.
 *
 * @public
 */
export interface RunDiagnostics {
	readonly nodes: readonly NodeDiagnostic[];
	readonly events: readonly RunEvent[];
}
