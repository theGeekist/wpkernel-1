import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	collectDocumentationInputs,
	computeSignature as computeCacheSignature,
} from './api-cache.cjs';

const moduleFilename = fileURLToPath(import.meta.url);
const moduleDirectory = path.dirname(moduleFilename);

const rootDir = path.resolve(moduleDirectory, '..', '..');
const docsDir = path.join(rootDir, 'docs');
const cacheFile = path.join(docsDir, 'api', '.typedoc-cache.json');
const apiIndexFile = path.join(docsDir, 'api', 'index.md');
const typedocConfig = path.join(rootDir, 'typedoc.json');
const CACHE_VERSION = 1;

const packages = [
	'core',
	'ui',
	'cli',
	'pipeline',
	'php-json-ast',
	'wp-json-ast',
	'test-utils',
	'e2e-utils',
	'create-wpk',
];

type CacheState = {
	version: number;
	signature: string;
};

type RunOptions = {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

function resolveBooleanEnv(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	return !['0', 'false', 'no'].includes(value.toLowerCase());
}

async function runCommand(
	command: string,
	args: string[],
	options: RunOptions = {}
) {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd ?? rootDir,
			env: { ...process.env, ...options.env },
			stdio: 'inherit',
		});

		child.on('error', (error) => {
			reject(error);
		});

		child.on('exit', (code, signal) => {
			if (code === 0) {
				resolve();
				return;
			}

			const reason =
				signal !== null && signal !== undefined
					? new Error(`${command} exited due to signal ${signal}`)
					: new Error(`${command} exited with code ${code}`);

			reject(reason);
		});
	});
}

async function readCache(): Promise<CacheState | null> {
	try {
		const raw = await fs.readFile(cacheFile, 'utf8');
		const parsed = JSON.parse(raw) as CacheState;

		if (
			parsed.version !== CACHE_VERSION ||
			typeof parsed.signature !== 'string'
		) {
			return null;
		}

		return parsed;
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}

		throw error;
	}
}

async function writeCache(signature: string) {
	const payload: CacheState = {
		version: CACHE_VERSION,
		signature,
	};

	await fs.mkdir(path.dirname(cacheFile), { recursive: true });
	await fs.writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf8');
}

async function writeApiIndex() {
	const packageLinks = packages.map(
		(pkg) => `- [\`@wpkernel/${pkg}\`](./@wpkernel/${pkg}/)`
	);
	const content = [
		'# API reference',
		'',
		'Generated reference documentation for the public WPKernel packages.',
		'',
		...packageLinks,
		'',
	].join('\n');

	await fs.mkdir(path.dirname(apiIndexFile), { recursive: true });
	await fs.writeFile(apiIndexFile, content, 'utf8');
}

async function clearGeneratedPackageDocs() {
	const generatedPackages = path.join(docsDir, 'api', '@wpkernel');
	if (await pathExists(generatedPackages)) {
		await fs.rm(generatedPackages, { recursive: true, force: true });
	}
}

async function assertGeneratedApiIndexes() {
	const expected = [
		apiIndexFile,
		...packages.map((pkg) =>
			path.join(docsDir, 'api', '@wpkernel', pkg, 'index.md')
		),
	];
	const existence = await Promise.all(expected.map(pathExists));
	const missing = expected.filter((_, index) => !existence[index]);

	if (missing.length > 0) {
		throw new Error(
			`Generated API routes are missing index files:\n${missing
				.map((file) => `- ${path.relative(rootDir, file)}`)
				.join('\n')}`
		);
	}
}

async function pathExists(target: string) {
	try {
		await fs.access(target);
		return true;
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return false;
		}

		throw error;
	}
}

export async function collectSourceFiles(): Promise<string[]> {
	return collectDocumentationInputs(rootDir, packages);
}

async function computeSignature(): Promise<string> {
	return computeCacheSignature(await collectSourceFiles());
}

// Build scripts often have sequential logic that naturally increases complexity
/* eslint-disable complexity */
async function main() {
	const args = process.argv.slice(2);
	const force =
		resolveBooleanEnv(process.env.DOCS_API_FORCE) ||
		args.includes('--force');
	const passThroughArgs = args.filter((arg) => arg !== '--force');
	const watchMode = passThroughArgs.includes('--watch');

	if (watchMode) {
		await clearGeneratedPackageDocs();
		// In watch mode, we might want to run Typedoc for all packages or a specific one.
		// For simplicity, let's run for all in watch mode too, but without caching.
		for (const pkg of packages) {
			const entryPoint = path.join(
				rootDir,
				'packages',
				pkg,
				'src',
				'index.ts'
			);
			const tsconfigPath = path.join(
				rootDir,
				'packages',
				pkg,
				'tsconfig.json'
			);
			const outDir = path.join(docsDir, 'api', '@wpkernel', pkg);

			if (await pathExists(entryPoint)) {
				console.log(`Generating API docs for @wpkernel/${pkg}...`);
				await runCommand('pnpm', [
					'exec',
					'typedoc',
					'--entryPoints',
					entryPoint,
					'--tsconfig',
					tsconfigPath,
					'--options',
					typedocConfig, // Use the root typedoc.json for global options
					'--out',
					outDir,
					...passThroughArgs,
				]);
			} else {
				console.warn(
					`Skipping API docs for @wpkernel/${pkg}: Entry point not found at ${entryPoint}`
				);
			}
		}
		await writeApiIndex();
		await runCommand('node', ['scripts/postprocess-typedoc.mjs']);
		await assertGeneratedApiIndexes();
		return;
	}

	const generatedDirs = packages.map((pkg) =>
		path.join(docsDir, 'api', '@wpkernel', pkg)
	);
	const allGeneratedExist = (
		await Promise.all([...generatedDirs, apiIndexFile].map(pathExists))
	).every(Boolean);
	const signature = await computeSignature();

	if (!force && allGeneratedExist) {
		const cache = await readCache();

		if (cache?.signature === signature) {
			console.log(
				'docs:api - cached output is up to date; skipping TypeDoc.'
			);
			return;
		}
	}

	console.log('docs:api - changes detected, regenerating TypeDoc output...');
	await clearGeneratedPackageDocs();
	for (const pkg of packages) {
		const entryPoint = path.join(
			rootDir,
			'packages',
			pkg,
			'src',
			'index.ts'
		);
		const tsconfigPath = path.join(
			rootDir,
			'packages',
			pkg,
			'tsconfig.json'
		);
		const outDir = path.join(docsDir, 'api', '@wpkernel', pkg);

		if (await pathExists(entryPoint)) {
			console.log(`Generating API docs for @wpkernel/${pkg}...`);
			await runCommand('pnpm', [
				'exec',
				'typedoc',
				'--entryPoints',
				entryPoint,
				'--tsconfig',
				tsconfigPath,
				'--options',
				typedocConfig, // Use the root typedoc.json for global options
				'--out',
				outDir,
				...passThroughArgs,
			]);
		} else {
			console.warn(
				`Skipping API docs for @wpkernel/${pkg}: Entry point not found at ${entryPoint}`
			);
		}
	}
	await writeApiIndex();
	await runCommand('node', ['scripts/postprocess-typedoc.mjs']);
	await assertGeneratedApiIndexes();
	await writeCache(signature);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryPath === moduleFilename) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
