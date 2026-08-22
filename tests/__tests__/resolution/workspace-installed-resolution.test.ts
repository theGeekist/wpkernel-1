import { execFile } from 'node:child_process';
import {
	mkdtemp,
	mkdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import ts from 'typescript';

const execFileAsync = promisify(execFile);
const workspaceRoot = path.resolve('.');
const fixtureRoot = path.join(
	workspaceRoot,
	'tests/fixtures/installed-consumers'
);
const temporaryRoots: string[] = [];

const resolveTaskGraphPipeline = async (): Promise<string> => {
	const source = String.raw`
		import { createRequire } from 'node:module';
		import path from 'node:path';

		const workspaceRequire = createRequire(path.join(process.cwd(), 'package.json'));
		const taskGraphEntry = workspaceRequire.resolve('@geekist/task-graph');
		const taskGraphRequire = createRequire(taskGraphEntry);
		process.stdout.write(taskGraphRequire.resolve('@wpkernel/pipeline'));
	`;
	const { stdout, stderr } = await execFileAsync(
		process.execPath,
		['--input-type=module', '--eval', source],
		{ cwd: workspaceRoot }
	);
	if (stderr !== '') {
		throw new Error(
			`Native installed-package resolution failed:\n${stderr}`
		);
	}
	return stdout;
};

const readConfig = (configPath: string): ts.ParsedCommandLine => {
	const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
	if (loaded.error) {
		throw new Error(
			ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n')
		);
	}
	return ts.parseJsonConfigFileContent(
		loaded.config,
		ts.sys,
		path.dirname(configPath),
		undefined,
		configPath
	);
};

describe('workspace and installed package resolution', () => {
	afterEach(async () => {
		await Promise.all(
			temporaryRoots
				.splice(0)
				.map((root) => rm(root, { force: true, recursive: true }))
		);
	});

	it('keeps first-party library imports on local Pipeline source', () => {
		const config = readConfig(
			path.join(workspaceRoot, 'tsconfig.lib.json')
		);
		const resolved = ts.resolveModuleName(
			'@wpkernel/pipeline',
			path.join(workspaceRoot, 'packages/core/src/resource/define.ts'),
			config.options,
			ts.sys
		).resolvedModule;

		expect(resolved?.resolvedFileName).toBe(
			path.join(workspaceRoot, 'packages/pipeline/src/index.ts')
		);
	});

	it('lets an installed dependency load its declared Pipeline version under Bun', async () => {
		const { stdout, stderr } = await execFileAsync(
			'bun',
			[path.join(fixtureRoot, 'task-graph-runtime.ts.fixture')],
			{ cwd: workspaceRoot }
		);

		expect(stderr).toBe('');
		expect(stdout).toBe('installed consumer resolved\n');
	});

	it('typechecks the installed Pipeline declarations under strict NodeNext', async () => {
		const publishedPipelineEntry = await resolveTaskGraphPipeline();
		const publishedPipelineRoot = path.dirname(
			path.dirname(publishedPipelineEntry)
		);
		const publishedManifest = JSON.parse(
			await readFile(
				path.join(publishedPipelineRoot, 'package.json'),
				'utf8'
			)
		) as { readonly name: string; readonly version: string };
		expect(publishedManifest).toMatchObject({
			name: '@wpkernel/pipeline',
			version: '1.4.1',
		});
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'wpk-installed-resolution-')
		);
		temporaryRoots.push(root);

		const packageParent = path.join(root, 'node_modules/@wpkernel');
		await mkdir(packageParent, { recursive: true });
		await symlink(
			publishedPipelineRoot,
			path.join(packageParent, 'pipeline'),
			'dir'
		);
		await Promise.all([
			writeFile(
				path.join(root, 'pipeline-nodenext.ts'),
				await readFile(
					path.join(fixtureRoot, 'pipeline-nodenext.ts.fixture'),
					'utf8'
				),
				'utf8'
			),
			writeFile(
				path.join(root, 'tsconfig.json'),
				await readFile(path.join(fixtureRoot, 'tsconfig.json'), 'utf8'),
				'utf8'
			),
		]);

		const config = readConfig(path.join(root, 'tsconfig.json'));
		const program = ts.createProgram(config.fileNames, config.options);
		const diagnostics = ts.getPreEmitDiagnostics(program);

		expect(
			ts.formatDiagnosticsWithColorAndContext(diagnostics, {
				getCanonicalFileName: (fileName) => fileName,
				getCurrentDirectory: () => root,
				getNewLine: () => '\n',
			})
		).toBe('');
	});
});
