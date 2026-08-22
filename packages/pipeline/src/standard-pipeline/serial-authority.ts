import type {
	HelperApplyOptions,
	HelperDescriptor,
	PipelineDiagnostic,
	PipelineReporter,
} from '../core/types.js';
import type { RegisteredHelper } from '../core/dependency-graph.js';
import type { SerialPipeline } from './serial-types.js';

export interface ErasedHelper {
	readonly attribution: HelperDescriptor;
	readonly key: string;
	readonly kind: string;
	readonly mode: 'extend' | 'override';
	readonly priority: number;
	readonly dependsOn: readonly string[];
	readonly origin?: string;
	readonly apply: (...args: never[]) => unknown;
}

export interface ErasedExtension {
	readonly key: string;
	readonly lifecycle: string;
	readonly hook: (...args: never[]) => unknown;
}

export interface SerialProgrammeAuthority {
	readonly fragmentKind: string;
	readonly builderKind: string;
	readonly fragments: readonly RegisteredHelper<ErasedHelper>[];
	readonly builders: readonly RegisteredHelper<ErasedHelper>[];
	readonly extensions: readonly ErasedExtension[];
	readonly createError: (code: string, message: string) => Error;
	readonly createBuildOptions: (options: unknown) => unknown;
	readonly createContext: (options: unknown) => {
		reporter: PipelineReporter;
	};
	readonly createFragmentState: (options: unknown) => unknown;
	readonly createFragmentArgs: (
		options: unknown
	) => HelperApplyOptions<unknown, unknown, unknown>;
	readonly adoptFragmentOutput?: (options: unknown) => unknown;
	readonly finalizeFragmentState: (options: unknown) => unknown;
	readonly createBuilderArgs: (
		options: unknown
	) => HelperApplyOptions<unknown, unknown, unknown>;
	readonly adoptBuilderOutput?: (options: unknown) => unknown;
	readonly createRunResult?: (options: unknown) => unknown;
	readonly onDiagnostic?: (options: unknown) => void;
	readonly onExtensionRollbackError?: (options: unknown) => void;
	readonly onHelperRollbackError?: (options: unknown) => void;
	readonly fragmentProvidedKeys: readonly string[];
	readonly builderProvidedKeys: readonly string[];
	readonly createMissingDependencyDiagnostic?: (
		options: unknown
	) => PipelineDiagnostic;
	readonly createUnusedHelperDiagnostic?: (
		options: unknown
	) => PipelineDiagnostic;
}

export interface SerialJournalEntry {
	readonly ordinal: number;
	readonly source: 'helper' | 'extension';
	readonly owner: unknown;
	readonly extensionKeys?: readonly string[];
	readonly commit?: unknown;
	readonly rollback?: unknown;
}

export type PreparedSerialOutcome =
	| { readonly kind: 'succeeded' }
	| { readonly kind: 'failed'; readonly error: unknown };
export type FinalisedSerialOutcome =
	| { readonly kind: 'succeeded'; readonly result: unknown }
	| { readonly kind: 'failed'; readonly error: unknown };

export interface PreparedSerialRun {
	readonly handle: string;
	readonly outcome: PreparedSerialOutcome;
	readonly journal: readonly SerialJournalEntry[];
	readonly authority: SerialProgrammeAuthority;
	readonly context?: unknown;
	readonly resultOptions: unknown;
}

export interface SerialRunAuthority {
	readonly programme: SerialProgrammeAuthority;
	readonly options: unknown;
	readonly signal?: AbortSignal;
	handle?: string;
}

const programmeAuthorities = new WeakMap<object, SerialProgrammeAuthority>();
const activeRuns = new Map<string, SerialRunAuthority>();
const preparedRuns = new Map<string, PreparedSerialRun>();
const finalisedRuns = new Map<string, FinalisedSerialOutcome>();
let runSequence = 0;

export const bindSerialProgramme = (
	token: object,
	authority: SerialProgrammeAuthority
): void => {
	programmeAuthorities.set(token, authority);
};

export const readSerialProgramme = (
	token: object
): SerialProgrammeAuthority | undefined => programmeAuthorities.get(token);

export const openSerialRun = (run: SerialRunAuthority): string => {
	runSequence += 1;
	const handle = `serial-run:${runSequence}`;
	run.handle = handle;
	activeRuns.set(handle, run);
	return handle;
};

export const readSerialRun = (handle: string): SerialRunAuthority | undefined =>
	activeRuns.get(handle);

export const retainPreparedSerialRun = (prepared: PreparedSerialRun): void => {
	preparedRuns.set(prepared.handle, prepared);
};

export const readPreparedSerialRun = (
	handle: string
): PreparedSerialRun | undefined => preparedRuns.get(handle);

export const retainFinalisedSerialRun = (
	handle: string,
	outcome: FinalisedSerialOutcome
): void => {
	finalisedRuns.set(handle, Object.freeze(outcome));
};

export const readFinalisedSerialRun = (
	handle: string
): FinalisedSerialOutcome | undefined => finalisedRuns.get(handle);

export const releaseSerialRun = (handle: string | undefined): void => {
	if (handle === undefined) {
		return;
	}
	activeRuns.delete(handle);
	preparedRuns.delete(handle);
	finalisedRuns.delete(handle);
};

export const isSerialPipelineToken = (
	value: unknown
): value is SerialPipeline<unknown, unknown> =>
	typeof value === 'object' &&
	value !== null &&
	programmeAuthorities.has(value);
