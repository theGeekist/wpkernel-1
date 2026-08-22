import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const { default: ts } = await import(
	join(repositoryRoot, 'node_modules', 'typescript', 'lib', 'typescript.js')
);
const sourceManifest = JSON.parse(
	readFileSync(join(packageRoot, 'package.json'), 'utf8')
);
const qualificationRoot = mkdtempSync(
	join(tmpdir(), 'wpkernel-pipeline-qualification-')
);
const suppliedTarball = process.argv[2]
	? resolve(process.cwd(), process.argv[2])
	: undefined;

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

const readReachableDeclarations = (entry) => {
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

const findReachableForbiddenSymbols = (
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

	const visitNode = (node) => {
		if (ts.isIdentifier(node)) {
			const referenced = checker.getSymbolAtLocation(node);
			if (referenced) {
				visitSymbol(referenced);
			}
		}
		ts.forEachChild(node, visitNode);
	};
	const recordForbiddenSymbols = (candidate, symbol) => {
		if (forbiddenNames.has(candidate.getName())) {
			found.add(candidate.getName());
		}
		if (forbiddenNames.has(symbol.getName())) {
			found.add(symbol.getName());
		}
	};
	const visitOwnedDeclarations = (symbol) => {
		for (const ownedDeclaration of symbol.declarations ?? []) {
			const declarationPath = ownedDeclaration.getSourceFile().fileName;
			for (const forbiddenModule of forbiddenModules) {
				if (declarationPath.includes(forbiddenModule)) {
					found.add(`module:${forbiddenModule}`);
				}
			}
			if (declarationPath.startsWith(declarationRoot)) {
				visitNode(ownedDeclaration);
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
		recordForbiddenSymbols(candidate, symbol);
		visitOwnedDeclarations(symbol);
	};

	for (const exported of checker.getExportsOfModule(moduleSymbol)) {
		visitSymbol(exported);
	}
	return found;
};

const source = String.raw`
import {
	createPipeline,
	runPipeline as runNativePipeline,
	type GraphDeclaration,
	type NodeContract,
} from '@wpkernel/pipeline';
import {
	createHelper,
	createSerialPipeline,
	runPipeline as runSerialPipeline,
	type SerialNativeOutcome,
	type SerialRunOutcome,
} from '@wpkernel/pipeline/v1';

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
	return (
		(typeof value === 'object' && value !== null) ||
		typeof value === 'function'
	) && typeof Reflect.get(value, 'then') === 'function';
}

type NativeInputs = Readonly<{ source: string }>;
type NativeNodes = Readonly<{
	uppercase: NodeContract<'source', string, never>;
}>;
type NativeOutputs = Readonly<{ result: 'uppercase' }>;

const declaration: GraphDeclaration<
	NativeInputs,
	NativeNodes,
	readonly [],
	Readonly<Record<never, never>>,
	NativeOutputs,
	Readonly<Record<never, never>>
> = {
	inputKeys: ['source'],
	nodes: {
		uppercase: { externalInputs: ['source'], effectKeys: [], priority: 0 },
	},
	edges: [],
	effects: {},
	outputs: { result: 'uppercase' },
	policy: { maxConcurrency: 1 },
	executors: {
		uppercase: ({ input }) => ({
			kind: 'success',
			output: input.external.source.toUpperCase(),
			effects: [],
		}),
	},
};

export const native = createPipeline({ declaration, participants: {} });
export const nativeOutcome = runNativePipeline({
	pipeline: native,
	inputs: { source: 'native' },
	capabilities: {},
});
if (isPromiseLike(nativeOutcome)) {
	throw new Error('Synchronous native graph became asynchronous.');
}
if (
	nativeOutcome.kind !== 'succeeded' || nativeOutcome.outputs.result !== 'NATIVE'
) {
	throw new Error('Native root did not preserve synchronous graph evaluation.');
}

export const serial = createSerialPipeline({
	createBuildOptions: () => ({}),
	createContext: () => ({ reporter: {} }),
	createFragmentState: () => [] as string[],
	createFragmentArgs: ({ context, draft }) => ({
		context,
		input: undefined,
		output: draft,
		reporter: context.reporter,
	}),
	finalizeFragmentState: ({ draft }) => draft,
	createBuilderArgs: ({ context, artifact }) => ({
		context,
		input: undefined,
		output: artifact,
		reporter: context.reporter,
	}),
	createRunResult: ({ artifact }) => artifact,
	fragments: [
		createHelper({
			key: 'fragment',
			kind: 'fragment',
			apply: ({ output }) => void (output as string[]).push('serial'),
		}),
	],
	builders: [],
});

export const serialOutcome = runSerialPipeline({ pipeline: serial, options: {} });
if (isPromiseLike(serialOutcome)) {
	throw new Error('Synchronous serial compatibility became asynchronous.');
}
export const typedSerialOutcome: SerialRunOutcome<unknown> = serialOutcome;
export type InferredNativeOutcome = typeof nativeOutcome;
export type InferredSerialPipeline = typeof serial;
export type InferredSerialOutcome = typeof serialOutcome;
type ExpectNever<T extends never> = T;
export type SerialSuspensionIsImpossible = ExpectNever<
	Extract<SerialNativeOutcome, { readonly kind: 'suspended' }>
>;
if (
	typedSerialOutcome.kind !== 'succeeded' ||
	JSON.stringify(typedSerialOutcome.result) !== JSON.stringify(['serial'])
) {
	throw new Error('Serial compatibility did not preserve helper output.');
}
if (
	typedSerialOutcome.native.effectJournal.some((entry) =>
		Object.values(entry).some((value) => typeof value === 'function')
	)
) {
	throw new Error('Native evidence exposed effect settlement authority.');
}

const root = await import('@wpkernel/pipeline');
const compatibility = await import('@wpkernel/pipeline/v1');
for (const rejected of [
	'createHelper',
	'createSerialPipeline',
	'makePipeline',
	'makeResumablePipeline',
]) {
	if (rejected in root) {
		throw new Error('Native root leaked compatibility symbol: ' + rejected);
	}
}
for (const rejected of [
	'createPipeline',
	'createPipelineExtension',
	'createPipelineRollback',
	'makePipeline',
	'makeResumablePipeline',
	'maybeThen',
]) {
	if (rejected in compatibility) {
		throw new Error('Compatibility entry leaked rejected authority: ' + rejected);
	}
}
`;

try {
	let tarballPath = suppliedTarball;
	if (tarballPath) {
		if (!existsSync(tarballPath)) {
			throw new Error(`Supplied tarball does not exist: ${tarballPath}`);
		}
	} else {
		execFileSync(
			'pnpm',
			['pack', '--pack-destination', qualificationRoot],
			{
				cwd: packageRoot,
				stdio: 'pipe',
			}
		);

		const tarball = readdirSync(qualificationRoot).find((entry) =>
			entry.endsWith('.tgz')
		);
		if (!tarball) {
			throw new Error('pnpm pack did not produce a tarball.');
		}
		tarballPath = join(qualificationRoot, tarball);
	}

	const fixtureRoot = join(qualificationRoot, 'consumer');
	const installedPackage = join(
		fixtureRoot,
		'node_modules',
		'@wpkernel',
		'pipeline'
	);
	mkdirSync(installedPackage, { recursive: true });
	execFileSync(
		'tar',
		['-xzf', tarballPath, '-C', installedPackage, '--strip-components=1'],
		{ stdio: 'pipe' }
	);

	const packedManifest = JSON.parse(
		readFileSync(join(installedPackage, 'package.json'), 'utf8')
	);
	if (
		packedManifest.name !== sourceManifest.name ||
		packedManifest.version !== sourceManifest.version
	) {
		throw new Error(
			'Packed package identity does not match the source manifest.'
		);
	}
	const exportKeys = Object.keys(packedManifest.exports ?? {}).sort();
	if (
		JSON.stringify(exportKeys) !==
		JSON.stringify(['.', './package.json', './v1'])
	) {
		throw new Error(
			`Packed package exposes unexpected entry points: ${exportKeys.join(', ')}`
		);
	}

	writeFileSync(
		join(fixtureRoot, 'package.json'),
		JSON.stringify({ private: true, type: 'module' }, null, 2)
	);
	writeFileSync(
		join(fixtureRoot, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					declaration: true,
					module: 'ESNext',
					moduleResolution: 'Bundler',
					outDir: 'dist',
					strict: true,
					target: 'ES2022',
				},
				include: ['src/**/*.ts'],
			},
			null,
			2
		)
	);
	writeFileSync(
		join(fixtureRoot, 'tsconfig.nodenext.json'),
		JSON.stringify(
			{
				compilerOptions: {
					module: 'NodeNext',
					moduleResolution: 'NodeNext',
					noEmit: true,
					skipLibCheck: false,
					strict: true,
					target: 'ES2022',
				},
				include: ['src/**/*.ts'],
			},
			null,
			2
		)
	);
	mkdirSync(join(fixtureRoot, 'src'), { recursive: true });
	writeFileSync(join(fixtureRoot, 'src', 'index.ts'), source);
	writeFileSync(
		join(fixtureRoot, 'src', 'rejected-root.ts'),
		"// @ts-expect-error compatibility authoring is not exported at the native root\nimport { createHelper } from '@wpkernel/pipeline';\nvoid createHelper;\n"
	);
	writeFileSync(
		join(fixtureRoot, 'src', 'rejected-v1.ts'),
		"// @ts-expect-error mutable runner authority is not exported by /v1\nimport { createPipeline } from '@wpkernel/pipeline/v1';\nvoid createPipeline;\n"
	);
	writeFileSync(
		join(fixtureRoot, 'src', 'rejected-deep.ts'),
		"// @ts-expect-error private implementation subpaths are not package exports\nimport { createHelper } from '@wpkernel/pipeline/dist/core/helper.js';\nvoid createHelper;\n"
	);

	const typescriptBin = join(
		repositoryRoot,
		'node_modules',
		'typescript',
		'bin',
		'tsc'
	);
	execFileSync(
		process.execPath,
		[typescriptBin, '--project', 'tsconfig.json'],
		{
			cwd: fixtureRoot,
			stdio: 'pipe',
		}
	);
	execFileSync(
		process.execPath,
		[typescriptBin, '--project', 'tsconfig.nodenext.json'],
		{
			cwd: fixtureRoot,
			stdio: 'pipe',
		}
	);

	const declaration = readFileSync(
		join(fixtureRoot, 'dist', 'index.d.ts'),
		'utf8'
	);
	if (
		!declaration.includes('InferredNativeOutcome') ||
		!declaration.includes('InferredSerialPipeline') ||
		!declaration.includes('InferredSerialOutcome')
	) {
		throw new Error(
			'Packed consumer declaration did not retain representative inferred values and outcomes.'
		);
	}
	if (
		declaration.includes('core/runner') ||
		declaration.includes('dist/core/') ||
		declaration.includes('AgnosticStageDeps')
	) {
		throw new Error(
			'External declarations leaked private Pipeline runner types.'
		);
	}

	readReachableDeclarations(join(installedPackage, 'dist', 'v1.d.ts'));
	const forbiddenSymbols = new Set([
		'PreparedSerialRun',
		'Suspension',
		'createPipelineExtension',
		'createPipelineRollback',
		'makePipeline',
		'makeResumablePipeline',
		'maybeThen',
	]);
	for (const rejectedSymbol of findReachableForbiddenSymbols(
		join(installedPackage, 'dist', 'v1.d.ts'),
		forbiddenSymbols,
		new Set(['serial-authority', 'suspension/types'])
	)) {
		if (rejectedSymbol) {
			throw new Error(
				`Compatibility declarations leaked rejected authority: ${rejectedSymbol}`
			);
		}
	}

	execFileSync(process.execPath, [join(fixtureRoot, 'dist', 'index.js')], {
		cwd: fixtureRoot,
		stdio: 'pipe',
	});

	console.log(
		`Packed Bundler and NodeNext API qualification passed: ${basename(tarballPath)}`
	);
} finally {
	rmSync(qualificationRoot, { recursive: true, force: true });
}
