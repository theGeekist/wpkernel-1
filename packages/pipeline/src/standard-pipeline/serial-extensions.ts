import type { ErasedExtension } from './serial-authority.js';
import type { SerialEvaluationState } from './serial-ordering.js';

interface CapturedExtensionResult {
	readonly artifact: unknown;
	readonly commit?: unknown;
	readonly rollback?: unknown;
}

export interface ExtensionAdmission {
	readonly state: SerialEvaluationState;
	readonly extension: ErasedExtension;
	readonly extensionKeys: readonly string[];
	readonly journalOrdinal: number;
	readonly returned: unknown;
}

function captureExtensionResult(
	result: unknown
): CapturedExtensionResult | undefined {
	if (!result) {
		return undefined;
	}
	const source = result as {
		readonly artifact?: unknown;
		readonly commit?: unknown;
		readonly rollback?: unknown;
	};
	const artifact = source.artifact;
	const commit = source.commit;
	const rollback = source.rollback;
	return {
		artifact,
		...(commit ? { commit } : {}),
		...(rollback ? { rollback } : {}),
	};
}

/**
 * Captures and admits one extension result without retaining caller aliases.
 * @param admission
 */
export function admitExtensionResult(admission: ExtensionAdmission): void {
	const { state, extension, extensionKeys, journalOrdinal, returned } =
		admission;
	const result = captureExtensionResult(returned);
	if (!result) {
		return;
	}
	if (result.artifact !== undefined) {
		state.artifact = result.artifact;
	}
	if (!result.commit && !result.rollback) {
		return;
	}
	state.journal.push(
		Object.freeze({
			ordinal: journalOrdinal,
			source: 'extension' as const,
			owner: extension,
			extensionKeys,
			...(result.commit ? { commit: result.commit } : {}),
			...(result.rollback ? { rollback: result.rollback } : {}),
		})
	);
}
