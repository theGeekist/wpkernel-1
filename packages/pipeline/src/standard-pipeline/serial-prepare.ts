import type {
	PreparedSerialRun,
	SerialRunAuthority,
} from './serial-authority.js';
import { evaluateSerialStages } from './serial-evaluator.js';
import { invokePublic } from './serial-invoke.js';
import {
	resolveOrder,
	type SerialEvaluationState,
	type SerialOrderingState,
} from './serial-ordering.js';

const freezePrepared = (
	state: SerialEvaluationState,
	handle: string,
	outcome: PreparedSerialRun['outcome']
): PreparedSerialRun =>
	Object.freeze({
		handle,
		outcome: Object.freeze(outcome),
		journal: Object.freeze(
			[...state.journal].sort(
				(left, right) => left.ordinal - right.ordinal
			)
		),
		authority: state.authority,
		context: state.context,
		resultOptions: Object.freeze({
			artifact: state.artifact,
			diagnostics: state.diagnostics,
			steps: state.steps,
			context: state.context,
			buildOptions: state.buildOptions,
			options: state.run.options,
			helpers: Object.freeze({
				fragments: state.helpers.get(state.authority.fragmentKind)!,
				builders: state.helpers.get(state.authority.builderKind)!,
			}),
		}),
	});

export const evaluateSerialRun = (
	run: SerialRunAuthority,
	handle: string
): PreparedSerialRun | Promise<PreparedSerialRun> => {
	let state: SerialEvaluationState | undefined;
	const authority = run.programme;
	let context: SerialEvaluationState['context'] = { reporter: {} };
	const diagnostics: SerialEvaluationState['diagnostics'] = [];
	let fragmentOrder: SerialEvaluationState['fragmentOrder'] = [];
	let builderOrder: SerialEvaluationState['builderOrder'] = [];
	try {
		context = invokePublic(authority.createContext, run.options);
		const orderingState: SerialOrderingState = {
			authority,
			context,
			diagnostics,
		};
		fragmentOrder = resolveOrder(
			orderingState,
			authority.fragmentKind,
			authority.fragments,
			authority.fragmentProvidedKeys
		);
		builderOrder = resolveOrder(
			orderingState,
			authority.builderKind,
			authority.builders,
			authority.builderProvidedKeys
		);
		const buildOptions = invokePublic(
			authority.createBuildOptions,
			run.options
		);
		const createdState: SerialEvaluationState = {
			run,
			authority,
			buildOptions,
			context,
			diagnostics,
			steps: [],
			journal: [],
			helpers: new Map(),
			fragmentOrder,
			builderOrder,
			draft: invokePublic(authority.createFragmentState, {
				options: run.options,
				context,
				buildOptions,
			}),
			artifact: undefined,
			nextJournalOrdinal: 0,
		};
		state = createdState;
		const evaluated = evaluateSerialStages(createdState);
		if (!(evaluated instanceof Promise)) {
			return freezePrepared(createdState, handle, { kind: 'succeeded' });
		}
		return evaluated.then(
			() => freezePrepared(createdState, handle, { kind: 'succeeded' }),
			(error) =>
				freezePrepared(createdState, handle, {
					kind: 'failed',
					error,
				})
		);
	} catch (error) {
		const fallback =
			state ??
			({
				run,
				authority,
				buildOptions: undefined,
				context,
				diagnostics,
				steps: [],
				journal: [],
				helpers: new Map(),
				fragmentOrder,
				builderOrder,
				draft: undefined,
				artifact: undefined,
				nextJournalOrdinal: 0,
			} satisfies SerialEvaluationState);
		return freezePrepared(fallback, handle, { kind: 'failed', error });
	}
};
