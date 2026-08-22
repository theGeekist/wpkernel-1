import {
	createDependencyGraph,
	type RegisteredHelper,
} from '../core/dependency-graph.js';
import type {
	HelperExecutionSnapshot,
	PipelineDiagnostic,
	PipelineReporter,
	PipelineStep,
} from '../core/types.js';
import type {
	ErasedHelper,
	SerialJournalEntry,
	SerialProgrammeAuthority,
	SerialRunAuthority,
} from './serial-authority.js';
import { invokePublic } from './serial-invoke.js';

export interface SerialEvaluationState {
	readonly run: SerialRunAuthority;
	readonly authority: SerialProgrammeAuthority;
	readonly buildOptions: unknown;
	readonly context: { reporter: PipelineReporter };
	readonly diagnostics: PipelineDiagnostic[];
	readonly steps: PipelineStep[];
	readonly journal: SerialJournalEntry[];
	readonly helpers: Map<string, HelperExecutionSnapshot>;
	readonly fragmentOrder: readonly RegisteredHelper<ErasedHelper>[];
	readonly builderOrder: readonly RegisteredHelper<ErasedHelper>[];
	draft: unknown;
	artifact: unknown;
	nextJournalOrdinal: number;
}

export type SerialOrderingState = Pick<
	SerialEvaluationState,
	'authority' | 'context' | 'diagnostics'
>;

const reportDiagnostic = (
	state: SerialOrderingState,
	diagnostic: PipelineDiagnostic
): void => {
	state.diagnostics.push(diagnostic);
	try {
		if (state.authority.onDiagnostic) {
			invokePublic(state.authority.onDiagnostic, {
				reporter: state.context.reporter,
				diagnostic,
			});
			return;
		}
		if (state.context.reporter.warn) {
			invokePublic(
				state.context.reporter.warn,
				'Pipeline diagnostic reported.',
				diagnostic
			);
		}
	} catch {
		// Diagnostic observers cannot alter serial evaluation.
	}
};

export const resolveOrder = (
	state: SerialOrderingState,
	kind: string,
	entries: readonly RegisteredHelper<ErasedHelper>[],
	providedKeys: readonly string[]
): RegisteredHelper<ErasedHelper>[] => {
	const mutableEntries = [...entries];
	return createDependencyGraph(
		mutableEntries,
		{
			providedKeys,
			onMissingDependency: ({ dependant, dependencyKey }) => {
				const helper = dependant.helper.attribution;
				const description = `${kind} helper "${helper.key}"`;
				const message = `${description} depends on unknown helper "${dependencyKey}".`;
				const diagnostic: PipelineDiagnostic = state.authority
					.createMissingDependencyDiagnostic
					? invokePublic(
							state.authority.createMissingDependencyDiagnostic,
							{
								helper,
								dependency: dependencyKey,
								message,
							}
						)
					: {
							type: 'missing-dependency',
							key: dependant.helper.key,
							dependency: dependencyKey,
							message,
							kind,
							helper: helper.origin ?? helper.key,
							dependsOn: helper.dependsOn,
						};
				reportDiagnostic(state, diagnostic);
				const unusedMessage = `${description} has missing dependencies.`;
				const unused: PipelineDiagnostic = state.authority
					.createUnusedHelperDiagnostic
					? invokePublic(
							state.authority.createUnusedHelperDiagnostic,
							{
								helper,
								message: unusedMessage,
							}
						)
					: {
							type: 'unused-helper',
							key: helper.key,
							message: unusedMessage,
							kind,
							helper: helper.origin ?? helper.key,
							dependsOn: helper.dependsOn,
						};
				reportDiagnostic(state, unused);
			},
			onUnresolvedHelpers: ({ unresolved }) => {
				for (const entry of unresolved) {
					const helper = entry.helper.attribution;
					const message = `${kind} helper "${helper.key}" has unresolved dependencies (possible cycle).`;
					const diagnostic: PipelineDiagnostic = state.authority
						.createUnusedHelperDiagnostic
						? invokePublic(
								state.authority.createUnusedHelperDiagnostic,
								{
									helper,
									message,
								}
							)
						: {
								type: 'unused-helper',
								key: helper.key,
								message,
								kind,
								helper: helper.origin ?? helper.key,
								dependsOn: helper.dependsOn,
							};
					reportDiagnostic(state, diagnostic);
				}
			},
		},
		state.authority.createError
	).order;
};
