import { compileErasedGraph } from './compiler.js';
import type {
	ErasedCompileGraphResult,
	ErasedGraphDeclaration,
	RegisteredGraphContribution,
} from './types.js';

/**
 * Internal dynamic-composition seam for P2-004.
 *
 * Its graph type is deliberately erased because runtime contributions cannot
 * honestly preserve the public declaration's literal registry generics.
 *
 * @internal
 * @param options               - Erased dynamic composition input.
 * @param options.declaration   - Base declaration.
 * @param options.contributions - Captured contributions.
 */
export const compileGraphWithContributions = (options: {
	readonly declaration: ErasedGraphDeclaration;
	readonly contributions: readonly RegisteredGraphContribution[];
}): ErasedCompileGraphResult =>
	compileErasedGraph({
		declaration: options.declaration,
		contributions: options.contributions,
	});
