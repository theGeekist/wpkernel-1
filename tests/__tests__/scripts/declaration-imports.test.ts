import { execFile } from 'node:child_process';
import {
	mkdtemp,
	mkdir,
	readFile,
	realpath,
	rm,
	writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = path.resolve('scripts/check-dts-imports.mjs');
const tsc = path.resolve('node_modules/.bin/tsc');
const fixtureRoots: string[] = [];

async function createFixture(contents: string, supportFiles: string[] = []) {
	const root = await mkdtemp(path.join(os.tmpdir(), 'wpk-dts-imports-'));
	fixtureRoots.push(root);
	const declaration = path.join(
		root,
		'packages',
		'example',
		'dist',
		'index.d.ts'
	);
	await mkdir(path.dirname(declaration), { recursive: true });
	await writeFile(declaration, contents, 'utf8');
	await Promise.all(
		supportFiles.map(async (file) => {
			const target = path.join(path.dirname(declaration), `${file}.d.ts`);
			await mkdir(path.dirname(target), { recursive: true });
			await writeFile(target, 'export {};\n', 'utf8');
		})
	);
	return { root, declaration };
}

describe('declaration import normalisation', () => {
	afterEach(async () => {
		await Promise.all(
			fixtureRoots.splice(0).map((root) => rm(root, { recursive: true }))
		);
	});

	it('normalises every relative TypeScript import form while preserving authored packages', async () => {
		const fixture = await createFixture(
			`
import type { Model } from './model';
export { build } from './build.ts';
export type { Legacy } from './legacy.d.ts';
export type Dynamic = import('./dynamic').Dynamic;
export type TypedDynamic = import('./typed.ts').TypedDynamic;
export type Directory = import('./folder').Directory;
export type TrailingDirectory = import('./folder/').Directory;
export type CurrentDirectory = import('./').CurrentDirectory;
export type { V1Pipeline } from '@wpkernel/pipeline/v1';
import type { ReadFile } from 'node:fs';
import type Schema from './schema.json';
import type Query from './query?raw';
import type Hash from './hash#fragment';
import type Existing from './existing.js';
`,
			[
				'model',
				'build',
				'legacy',
				'dynamic',
				'typed',
				'folder/index',
				'existing',
			]
		);

		await execFileAsync(process.execPath, [script, '--fix'], {
			cwd: fixture.root,
		});

		const emitted = await readFile(fixture.declaration, 'utf8');
		expect(emitted).toContain('from "./model.js"');
		expect(emitted).toContain('from "./build.js"');
		expect(emitted).toMatch(/from ['"]\.\/legacy\.d\.ts['"]/u);
		expect(emitted).toContain('import("./dynamic.js")');
		expect(emitted).toContain('import("./typed.js")');
		expect(emitted).toContain('import("./folder/index.js")');
		expect(emitted).toContain('import("./index.js")');
		expect(emitted).not.toContain('folder//index.js');
		expect(emitted).toMatch(/from ['"]@wpkernel\/pipeline\/v1['"]/u);
		expect(emitted).toMatch(/from ['"]node:fs['"]/u);
		expect(emitted).toMatch(/from ['"]\.\/schema\.json['"]/u);
		expect(emitted).toMatch(/from ['"]\.\/query\?raw['"]/u);
		expect(emitted).toMatch(/from ['"]\.\/hash#fragment['"]/u);
		expect(emitted).toMatch(/from ['"]\.\/existing\.js['"]/u);

		await expect(
			execFileAsync(process.execPath, [script], { cwd: fixture.root })
		).resolves.toMatchObject({ stderr: '' });
	});

	it('reports every unresolved relative specifier and source-boundary leak', async () => {
		const fixture = await createFixture(`
import type { First } from './first';
export type { Second } from '../second.ts';
export type Third = import('./third').Third;
export type { Pipeline } from '../../../pipeline/src/v1';
`);

		try {
			await execFileAsync(process.execPath, [script], {
				cwd: fixture.root,
			});
			throw new Error('Expected declaration import audit to fail');
		} catch (error) {
			const stderr = (error as { stderr: string }).stderr;
			expect(stderr).toContain(
				'non-NodeNext relative specifier: ../second.ts'
			);
			expect(stderr).toContain(
				'non-NodeNext relative specifier: ./third'
			);
			expect(stderr).toContain(
				'package source path: ../../../pipeline/src/v1'
			);
		}
	});

	it('preserves a valid emitted directory named src', async () => {
		const fixture = await createFixture(
			`import type { Model } from './src/types.js';\n`,
			['src/types']
		);

		await expect(
			execFileAsync(process.execPath, [script], { cwd: fixture.root })
		).resolves.toMatchObject({ stderr: '' });
	});

	it('removes only maps invalidated by declaration rewriting', async () => {
		const fixture = await createFixture(
			`import type { Model } from './model';\n//# sourceMappingURL=index.d.ts.map\n`,
			['model']
		);
		const changedMap = `${fixture.declaration}.map`;
		await writeFile(changedMap, '{"version":3}', 'utf8');

		const unchanged = path.join(
			path.dirname(fixture.declaration),
			'stable.d.ts'
		);
		const unchangedMap = `${unchanged}.map`;
		await writeFile(
			unchanged,
			`import type { Model } from './model.js';\n//# sourceMappingURL=stable.d.ts.map\n`,
			'utf8'
		);
		await writeFile(unchangedMap, '{"version":3}', 'utf8');

		await execFileAsync(process.execPath, [script, '--fix'], {
			cwd: fixture.root,
		});

		const changed = await readFile(fixture.declaration, 'utf8');
		expect(changed).toContain('from "./model.js"');
		expect(changed).not.toContain('sourceMappingURL');
		await expect(readFile(changedMap, 'utf8')).rejects.toMatchObject({
			code: 'ENOENT',
		});
		expect(await readFile(unchanged, 'utf8')).toContain(
			'sourceMappingURL=stable.d.ts.map'
		);
		await expect(readFile(unchangedMap, 'utf8')).resolves.toBe(
			'{"version":3}'
		);
	});

	it('normalises and audits ESM and CJS declaration module kinds', async () => {
		const fixture = await createFixture('export {};\n');
		const dist = path.dirname(fixture.declaration);
		await Promise.all([
			writeFile(
				path.join(dist, 'esm.d.mts'),
				`export type { Value } from './value.mts';\n//# sourceMappingURL=esm.d.mts.map\n`,
				'utf8'
			),
			writeFile(
				path.join(dist, 'value.d.mts'),
				'export type Value = string;\n',
				'utf8'
			),
			writeFile(
				path.join(dist, 'common.d.cts'),
				`export type { Value } from './common-value.cts';\n//# sourceMappingURL=common.d.cts.map\n`,
				'utf8'
			),
			writeFile(
				path.join(dist, 'common-value.d.cts'),
				'export type Value = number;\n',
				'utf8'
			),
			writeFile(
				path.join(dist, 'esm.d.mts.map'),
				'{"version":3}',
				'utf8'
			),
			writeFile(
				path.join(dist, 'common.d.cts.map'),
				'{"version":3}',
				'utf8'
			),
		]);

		await execFileAsync(process.execPath, [script, '--fix'], {
			cwd: fixture.root,
		});
		await expect(
			execFileAsync(process.execPath, [script], { cwd: fixture.root })
		).resolves.toMatchObject({ stderr: '' });

		expect(await readFile(path.join(dist, 'esm.d.mts'), 'utf8')).toContain(
			'from "./value.mjs"'
		);
		expect(
			await readFile(path.join(dist, 'common.d.cts'), 'utf8')
		).toContain('from "./common-value.cjs"');

		await Promise.all([
			writeFile(
				path.join(fixture.root, 'consumer.mts'),
				`import type { Value } from './packages/example/dist/esm.mjs';\nconst value: Value = 'ok';\nvoid value;\n`,
				'utf8'
			),
			writeFile(
				path.join(fixture.root, 'consumer.cts'),
				`import type { Value } from './packages/example/dist/common.cjs';\nconst value: Value = 1;\nvoid value;\n`,
				'utf8'
			),
			writeFile(
				path.join(fixture.root, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						module: 'NodeNext',
						moduleResolution: 'NodeNext',
						noEmit: true,
						strict: true,
						skipLibCheck: false,
					},
					include: ['consumer.mts', 'consumer.cts'],
				}),
				'utf8'
			),
		]);
		await expect(
			execFileAsync(tsc, ['-p', 'tsconfig.json'], { cwd: fixture.root })
		).resolves.toMatchObject({ stderr: '' });
	}, 30_000);

	it('publishes an exact compile-time contract for the shared build seam', async () => {
		const implementation = path.resolve('scripts/declaration-imports.mjs');
		const exportProbe = await execFileAsync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				`import * as runtimeModule from ${JSON.stringify(pathToFileURL(implementation).href)}; process.stdout.write(JSON.stringify(Object.keys(runtimeModule).sort()));`,
			],
			{ cwd: process.cwd() }
		);
		expect(JSON.parse(exportProbe.stdout)).toEqual([
			'findDeclarationImportOffenders',
			'isRelativeDeclarationSpecifier',
			'normaliseDeclarationImports',
			'normaliseDeclarationModuleSpecifier',
			'removeDeclarationSourceMapReference',
		]);

		const root = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-dts-import-contract-')
		);
		fixtureRoots.push(root);
		const canonicalRoot = await realpath(root);
		const relativeImplementation = path
			.relative(canonicalRoot, implementation)
			.split(path.sep)
			.join('/');
		const specifier = relativeImplementation.startsWith('.')
			? relativeImplementation
			: `./${relativeImplementation}`;

		await Promise.all([
			writeFile(
				path.join(root, 'contract.mts'),
				`import * as declarationImports from ${JSON.stringify(specifier)};

type Normalisation =
  | { changed: false; text: string }
  | { changed: true; text: string };
type Offender = {
  reason: string;
  specifier: string;
  line: number;
  column: number;
};
type ExpectedModule = {
  isRelativeDeclarationSpecifier: (specifier: string) => boolean;
  normaliseDeclarationModuleSpecifier: (
    specifier: string,
    fileName?: string,
    declarationFiles?: Iterable<string>
  ) => string;
  normaliseDeclarationImports: (
    sourceText: string,
    fileName?: string,
    declarationFiles?: Iterable<string>
  ) => Normalisation;
  removeDeclarationSourceMapReference: (sourceText: string) => string;
  findDeclarationImportOffenders: (
    sourceText: string,
    fileName?: string,
    declarationFiles?: Iterable<string>
  ) => Offender[];
};
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends
  (<T>() => T extends TRight ? 1 : 2)
    ? true
    : false;
type Assert<TValue extends true> = TValue;
type ExportKeysAreExact = Assert<
  Equal<keyof typeof declarationImports, keyof ExpectedModule>
>;

const declaredAsExpected: ExpectedModule = declarationImports;
const expectedAsDeclared: typeof declarationImports = declaredAsExpected;
const exportKeysAreExact: ExportKeysAreExact = true;
void expectedAsDeclared;
void exportKeysAreExact;
`,
				'utf8'
			),
			writeFile(
				path.join(root, 'tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						module: 'NodeNext',
						moduleResolution: 'NodeNext',
						noEmit: true,
						strict: true,
						skipLibCheck: false,
					},
					include: ['contract.mts'],
				}),
				'utf8'
			),
		]);

		try {
			const result = await execFileAsync(tsc, ['-p', 'tsconfig.json'], {
				cwd: root,
			});
			expect(result.stderr).toBe('');
		} catch (error) {
			const processError = error as {
				stdout?: string;
				stderr?: string;
			};
			throw new Error(
				processError.stdout || processError.stderr || String(error)
			);
		}
	}, 30_000);
});
