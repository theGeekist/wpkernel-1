/* eslint-disable no-unused-vars -- declaration signatures retain parameter names as contract documentation. */

interface DeclarationImportOffender {
	reason: string;
	specifier: string;
	line: number;
	column: number;
}

type DeclarationImportNormalisation =
	| { changed: false; text: string }
	| { changed: true; text: string };

export function isRelativeDeclarationSpecifier(specifier: string): boolean;

export function normaliseDeclarationModuleSpecifier(
	specifier: string,
	fileName?: string,
	declarationFiles?: Iterable<string>
): string;

export function normaliseDeclarationImports(
	sourceText: string,
	fileName?: string,
	declarationFiles?: Iterable<string>
): DeclarationImportNormalisation;

export function removeDeclarationSourceMapReference(sourceText: string): string;

export function findDeclarationImportOffenders(
	sourceText: string,
	fileName?: string,
	declarationFiles?: Iterable<string>
): DeclarationImportOffender[];
