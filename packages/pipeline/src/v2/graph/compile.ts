import { compileErasedGraph } from './compiler.js';
import { diagnostic } from './diagnostics.js';
import { createGraphCompilationError } from './errors.js';
import { inspectRecord } from './inspection.js';
import type {
	CompileGraphOptions,
	CompileGraphResult,
	Edge,
	EffectRegistry,
	Graph,
	GraphDiagnostic,
	GraphValue,
	NodeRegistry,
	OutputProjection,
} from './types.js';

const inspectStaticOptions = (
	value: unknown
): {
	readonly declaration: unknown;
	readonly diagnostics: readonly GraphDiagnostic[];
} => {
	try {
		const inspected = inspectRecord(value);
		if (!inspected.ok) {
			throw new Error(inspected.reason);
		}
		const fields = new Map(
			inspected.value.map(
				({ key, value: field }) => [key, field] as const
			)
		);
		return {
			declaration: fields.get('declaration'),
			diagnostics: fields.has('contributions')
				? [
						diagnostic(
							'invalid-contribution',
							'Dynamic contributions require the internal erased extension compiler.',
							['contributions']
						),
					]
				: [],
		};
	} catch {
		return {
			declaration: undefined,
			diagnostics: [
				diagnostic(
					'invalid-node',
					'Compile options must be inspectable immutable data.',
					['declaration']
				),
			],
		};
	}
};

/**
 * Compiles a static declaration into the immutable graph authority.
 *
 * @param options - Exact declaration-only compilation input.
 */
export const compileGraph = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
>(
	options: CompileGraphOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>
): CompileGraphResult<
	TInputs,
	TNodes,
	TEdges,
	TEffects,
	TProjection,
	TCapabilities
> => {
	const inspected = inspectStaticOptions(options);
	return compileErasedGraph({
		declaration: inspected.declaration,
		initialDiagnostics: inspected.diagnostics,
	}) as CompileGraphResult<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>;
};

/**
 * Exception-oriented adapter retaining every compilation diagnostic.
 *
 * @param options - Exact declaration-only compilation input.
 */
export const compileGraphOrThrow = <
	TInputs extends Readonly<Record<string, GraphValue>>,
	TNodes extends NodeRegistry,
	TEdges extends readonly Edge[],
	TEffects extends EffectRegistry,
	TProjection extends OutputProjection<TNodes>,
	TCapabilities,
>(
	options: CompileGraphOptions<
		TInputs,
		TNodes,
		TEdges,
		TEffects,
		TProjection,
		TCapabilities
	>
): Graph<TInputs, TNodes, TEdges, TEffects, TProjection, TCapabilities> => {
	const result = compileGraph(options);
	if (!result.ok) {
		throw createGraphCompilationError({ diagnostics: result.diagnostics });
	}
	return result.graph;
};
