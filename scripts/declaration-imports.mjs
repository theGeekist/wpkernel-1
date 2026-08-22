// eslint-disable-next-line import/no-extraneous-dependencies -- shared build tooling uses the workspace compiler API.
import ts from 'typescript';
import path from 'node:path';

const declarationExtensions = /\.d\.(?:ts|mts|cts)$/u;
const sourceExtensions = /\.(?:ts|tsx|mts|cts)$/u;
const relativeSpecifier = /^(?:\.\/|\.\.\/)/u;
const queryOrHash = /[?#]/u;
const declarationKinds = Object.freeze([
	Object.freeze({ declaration: '.d.ts', runtime: '.js' }),
	Object.freeze({ declaration: '.d.mts', runtime: '.mjs' }),
	Object.freeze({ declaration: '.d.cts', runtime: '.cjs' }),
]);

/**
 * Return whether a declaration module specifier points at a relative ESM file.
 *
 * Package names, `node:` built-ins, import maps, and absolute URLs are outside
 * the NodeNext relative-specifier rule.
 *
 * @param {string} specifier Module specifier from an emitted declaration.
 * @returns {boolean} Whether the specifier names a relative ESM module.
 */
export function isRelativeDeclarationSpecifier(specifier) {
	return relativeSpecifier.test(specifier);
}

/**
 * Normalise a relative TypeScript source reference for emitted ESM declarations.
 *
 * Declaration and non-TypeScript extensions are deliberately left alone. A
 * declaration file can validly name another declaration file, while TypeScript
 * source names must become the JavaScript names that exist at runtime.
 *
 * @param {string}           specifier          Module specifier from an emitted declaration.
 * @param {string}           [fileName]         Emitted declaration file containing the import.
 * @param {Iterable<string>} [declarationFiles] All emitted declaration paths.
 * @returns {string} The NodeNext-safe module specifier.
 */
export function normaliseDeclarationModuleSpecifier(
	specifier,
	fileName = 'index.d.ts',
	declarationFiles = []
) {
	if (
		!isRelativeDeclarationSpecifier(specifier) ||
		queryOrHash.test(specifier) ||
		declarationExtensions.test(specifier)
	) {
		return specifier;
	}

	if (sourceExtensions.test(specifier)) {
		return specifier.replace(sourceExtensions, (extension) => {
			if (extension === '.mts') {
				return '.mjs';
			}
			if (extension === '.cts') {
				return '.cjs';
			}
			return '.js';
		});
	}

	if (/\.[^/]+$/u.test(specifier)) {
		return specifier;
	}

	return resolveRelativeDeclarationSpecifier(specifier, fileName, [
		...declarationFiles,
	]);
}

function updateStringLiteral(literal, specifier) {
	return specifier === literal.text
		? literal
		: ts.factory.createStringLiteral(specifier);
}

function getImportTypeSpecifier(node) {
	return ts.isLiteralTypeNode(node.argument) &&
		ts.isStringLiteral(node.argument.literal)
		? node.argument.literal
		: undefined;
}

function createDeclarationPathSet(declarationFiles) {
	return new Set([...declarationFiles].map((file) => path.resolve(file)));
}

function resolveRelativeDeclarationSpecifier(
	specifier,
	fileName,
	declarationFiles
) {
	if (declarationFiles.length === 0) {
		return `${specifier}.js`;
	}

	const files = createDeclarationPathSet(declarationFiles);
	const target = path.resolve(path.dirname(fileName), specifier);
	for (const kind of declarationKinds) {
		if (files.has(`${target}${kind.declaration}`)) {
			return `${specifier}${kind.runtime}`;
		}
	}

	for (const kind of declarationKinds) {
		if (files.has(path.join(target, `index${kind.declaration}`))) {
			return `${specifier.replace(/\/+$/u, '')}/index${kind.runtime}`;
		}
	}

	return `${specifier}.js`;
}

function declarationTargetForRuntimeSpecifier(
	specifier,
	fileName,
	declarationFiles
) {
	const kind = declarationKinds.find(({ runtime }) =>
		specifier.endsWith(runtime)
	);
	if (!kind || declarationFiles.length === 0) {
		return undefined;
	}

	const target = path.resolve(
		path.dirname(fileName),
		specifier.slice(0, -kind.runtime.length) + kind.declaration
	);
	return createDeclarationPathSet(declarationFiles).has(target)
		? target
		: undefined;
}

function hasDeclarationTarget(specifier, fileName, declarationFiles) {
	if (declarationFiles.length === 0) {
		return false;
	}

	if (
		declarationTargetForRuntimeSpecifier(
			specifier,
			fileName,
			declarationFiles
		)
	) {
		return true;
	}

	if (/\.[^/]+$/u.test(specifier)) {
		return false;
	}

	const normalised = resolveRelativeDeclarationSpecifier(
		specifier,
		fileName,
		declarationFiles
	);
	return (
		declarationTargetForRuntimeSpecifier(
			normalised,
			fileName,
			declarationFiles
		) !== undefined
	);
}

function rewriteImportDeclaration(node, visitor) {
	if (!ts.isImportDeclaration(node)) {
		return undefined;
	}

	if (!ts.isStringLiteral(node.moduleSpecifier)) {
		return node;
	}

	const nextSpecifier = visitor(node.moduleSpecifier);
	return nextSpecifier === node.moduleSpecifier
		? node
		: ts.factory.updateImportDeclaration(
				node,
				node.modifiers,
				node.importClause,
				nextSpecifier,
				node.assertClause
			);
}

function rewriteExportDeclaration(node, visitor) {
	if (!ts.isExportDeclaration(node)) {
		return undefined;
	}

	if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
		return node;
	}

	const nextSpecifier = visitor(node.moduleSpecifier);
	return nextSpecifier === node.moduleSpecifier
		? node
		: ts.factory.updateExportDeclaration(
				node,
				node.modifiers,
				node.isTypeOnly,
				node.exportClause,
				nextSpecifier,
				node.assertClause
			);
}

function rewriteImportType(node, visitor) {
	if (!ts.isImportTypeNode(node)) {
		return undefined;
	}

	const specifier = getImportTypeSpecifier(node);
	if (!specifier) {
		return node;
	}

	const nextSpecifier = visitor(specifier);
	return nextSpecifier === specifier
		? node
		: ts.factory.updateImportTypeNode(
				node,
				ts.factory.createLiteralTypeNode(nextSpecifier),
				node.attributes,
				node.qualifier,
				node.typeArguments,
				node.isTypeOf
			);
}

function visitDeclarationModuleSpecifiers(sourceFile, visitor) {
	const transformer = (context) => {
		const visit = (node) => {
			const importDeclaration = rewriteImportDeclaration(node, visitor);
			if (importDeclaration) {
				return importDeclaration;
			}

			const exportDeclaration = rewriteExportDeclaration(node, visitor);
			if (exportDeclaration) {
				return exportDeclaration;
			}

			const importType = rewriteImportType(node, visitor);
			if (importType) {
				return importType;
			}

			return ts.visitEachChild(node, visit, context);
		};

		return (node) => ts.visitNode(node, visit);
	};

	return ts.transform(sourceFile, [transformer]).transformed[0];
}

/**
 * Rewrite the relative source references in one emitted declaration file.
 *
 * @param {string}           sourceText         Emitted declaration source text.
 * @param {string}           [fileName]         Declaration file name for parser diagnostics.
 * @param {Iterable<string>} [declarationFiles] All emitted declaration paths.
 * @returns {{ changed: boolean; text: string }} Rewritten declaration output.
 */
export function normaliseDeclarationImports(
	sourceText,
	fileName = 'index.d.ts',
	declarationFiles = []
) {
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	let changed = false;
	const rewritten = visitDeclarationModuleSpecifiers(
		sourceFile,
		(literal) => {
			const specifier = normaliseDeclarationModuleSpecifier(
				literal.text,
				fileName,
				declarationFiles
			);
			if (specifier === literal.text) {
				return literal;
			}
			changed = true;
			return updateStringLiteral(literal, specifier);
		}
	);

	if (!changed) {
		return { changed: false, text: sourceText };
	}

	return {
		changed: true,
		text: removeDeclarationSourceMapReference(
			ts
				.createPrinter({ newLine: ts.NewLineKind.LineFeed })
				.printFile(rewritten)
		),
	};
}

/**
 * Remove a declaration-map trailer after changing the declaration text.
 *
 * The adjacent map describes the original generated columns and must not be
 * retained after module specifiers have changed.
 *
 * @param {string} sourceText Emitted declaration source text.
 * @returns {string} Declaration text without its source-map reference.
 */
export function removeDeclarationSourceMapReference(sourceText) {
	return sourceText.replace(
		/(?:\r?\n)?\/\/# sourceMappingURL=[^\r\n]+\.map\s*$/u,
		'\n'
	);
}

function hasResolvableDeclarationTarget(specifier, fileName, declarationFiles) {
	if (declarationFiles.length === 0) {
		return true;
	}
	if (!declarationKinds.some(({ runtime }) => specifier.endsWith(runtime))) {
		return true;
	}
	return (
		declarationTargetForRuntimeSpecifier(
			specifier,
			fileName,
			declarationFiles
		) !== undefined
	);
}

function classifyDeclarationSpecifier(specifier, fileName, declarationFiles) {
	if (
		!isRelativeDeclarationSpecifier(specifier) ||
		queryOrHash.test(specifier)
	) {
		return undefined;
	}

	const normalised = normaliseDeclarationModuleSpecifier(
		specifier,
		fileName,
		declarationFiles
	);
	const targetExists = hasDeclarationTarget(
		specifier,
		fileName,
		declarationFiles
	);
	if (normalised !== specifier) {
		if (/(?:^|\/)src(?:\/|$)/u.test(specifier) && !targetExists) {
			return 'package source path';
		}
		return 'non-NodeNext relative specifier';
	}

	if (/(?:^|\/)src(?:\/|$)/u.test(specifier) && !targetExists) {
		return 'package source path';
	}

	return hasResolvableDeclarationTarget(specifier, fileName, declarationFiles)
		? undefined
		: 'unresolvable declaration target';
}

/**
 * Find every declaration reference that violates the emitted-package boundary.
 *
 * @param {string}           sourceText         Emitted declaration source text.
 * @param {string}           [fileName]         Declaration file name for diagnostics.
 * @param {Iterable<string>} [declarationFiles] All emitted declaration paths.
 * @returns {Array<{ reason: string; specifier: string; line: number; column: number }>} Every offender.
 */
export function findDeclarationImportOffenders(
	sourceText,
	fileName = 'index.d.ts',
	declarationFiles = []
) {
	const sourceFile = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const offenders = [];

	const inspect = (literal) => {
		const reason = classifyDeclarationSpecifier(
			literal.text,
			fileName,
			declarationFiles
		);
		if (!reason) {
			return;
		}
		const { line, character } = sourceFile.getLineAndCharacterOfPosition(
			literal.getStart(sourceFile)
		);
		offenders.push({
			reason,
			specifier: literal.text,
			line: line + 1,
			column: character + 1,
		});
	};

	const visit = (node) => {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			inspect(node.moduleSpecifier);
		}

		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			inspect(node.moduleSpecifier);
		}

		if (ts.isImportTypeNode(node)) {
			const specifier = getImportTypeSpecifier(node);
			if (specifier) {
				inspect(specifier);
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return offenders;
}
