import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const declarationCandidates = (owner, specifier) => {
	const target = resolve(dirname(owner), specifier);
	if (/\.mjs$/u.test(target)) {
		return [target.replace(/\.mjs$/u, '.d.mts')];
	}
	if (/\.cjs$/u.test(target)) {
		return [target.replace(/\.cjs$/u, '.d.cts')];
	}
	if (/\.js$/u.test(target)) {
		return [target.replace(/\.js$/u, '.d.ts')];
	}
	return [
		`${target}.d.ts`,
		`${target}.d.mts`,
		`${target}.d.cts`,
		join(target, 'index.d.ts'),
	];
};

export const readReachableDeclarations = (entry) => {
	const pending = [entry];
	const visited = new Set();
	const declarations = [];
	const specifiers = [];
	while (pending.length > 0) {
		const path = pending.pop();
		if (!path || visited.has(path)) {
			continue;
		}
		visited.add(path);
		const source = readFileSync(path, 'utf8')
			.replace(/\/\*[\s\S]*?\*\//gu, '')
			.replace(/\/\/.*$/gmu, '');
		declarations.push(source);
		const matcher = /(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/gu;
		for (const match of source.matchAll(matcher)) {
			const specifier = match[1];
			specifiers.push(specifier);
			const resolved = declarationCandidates(path, specifier).find(
				(candidate) => existsSync(candidate)
			);
			if (!resolved) {
				throw new Error(
					`Reachable declaration import could not be resolved: ${specifier} from ${path}`
				);
			}
			pending.push(resolved);
		}
	}
	return { declarations: declarations.join('\n'), specifiers };
};

export const findReachableForbiddenSymbols = (
	ts,
	entry,
	forbiddenNames,
	forbiddenModules
) => {
	const program = ts.createProgram({
		rootNames: [entry],
		options: {
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			skipLibCheck: true,
		},
	});
	const checker = program.getTypeChecker();
	const source = program.getSourceFile(entry);
	const moduleSymbol = source && checker.getSymbolAtLocation(source);
	if (!source || !moduleSymbol) {
		throw new Error(
			`Could not inspect compatibility declaration symbols: ${entry}`
		);
	}
	const found = new Set();
	const visitedSymbols = new Set();
	const declarationRoot = dirname(dirname(entry));
	const recordForbiddenNames = (candidate, symbol) => {
		for (const named of [candidate, symbol]) {
			if (forbiddenNames.has(named.getName())) {
				found.add(named.getName());
			}
		}
	};
	const recordForbiddenModule = (declarationPath) => {
		const matched = [...forbiddenModules].find((module) =>
			declarationPath.includes(module)
		);
		if (matched) {
			found.add(`module:${matched}`);
		}
	};

	const visitNode = (node) => {
		if (ts.isIdentifier(node)) {
			const referenced = checker.getSymbolAtLocation(node);
			if (referenced) {
				visitSymbol(referenced);
			}
		}
		ts.forEachChild(node, visitNode);
	};
	const visitOwnedDeclarations = (symbol) => {
		for (const declaration of symbol.declarations ?? []) {
			const declarationPath = declaration.getSourceFile().fileName;
			recordForbiddenModule(declarationPath);
			if (declarationPath.startsWith(declarationRoot)) {
				visitNode(declaration);
			}
		}
	};
	const visitSymbol = (candidate) => {
		if (!candidate || visitedSymbols.has(candidate)) {
			return;
		}
		visitedSymbols.add(candidate);
		const symbol =
			candidate.flags === ts.SymbolFlags.Alias
				? checker.getAliasedSymbol(candidate)
				: candidate;
		recordForbiddenNames(candidate, symbol);
		visitOwnedDeclarations(symbol);
	};

	for (const exported of checker.getExportsOfModule(moduleSymbol)) {
		visitSymbol(exported);
	}
	return found;
};
